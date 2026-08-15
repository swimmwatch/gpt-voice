#!/usr/bin/env python3
"""Role-aware PSS/NVML sampler for one private performance attempt."""

from __future__ import annotations

import ctypes
import errno
import hashlib
import json
import os
from pathlib import Path
import select
import signal
import stat
import sys
import time

INTERVAL_NS = 100_000_000
MAXIMUM_SAMPLES = 36_000
SETTLED_SAMPLES = 10
MAXIMUM_CONFIG_BYTES = 4096
MAXIMUM_EVENT_BYTES = 65_536
MAXIMUM_EVENT_COUNT = 64
MAXIMUM_FRAME_BYTES = 1024
READINESS_FD = 3
READINESS_FRAME = b"READY\n"
ROLES = ("main", "guard", "worker")
NVML_SUCCESS = 0
NVML_ERROR_INSUFFICIENT_SIZE = 7
NVML_VALUE_NOT_AVAILABLE = (1 << 64) - 1
NVML_QUERY_ATTEMPTS = 4
NVML_PROCESS_HEADROOM = 16
PSS_READ_ATTEMPTS = 4
PSS_EXIT_CONFIRMATION_MILLISECONDS = 100
SAFE_FAILURE_CODES = frozenset(
    {
        "config-size",
        "config-duplicate",
        "config-shape",
        "config-identity",
        "config-pid",
        "config-device",
        "event-size",
        "event-shape",
        "event-sequence",
        "event-role",
        "event-terminal",
        "event-incomplete",
        "pid-reuse",
        "process-identity",
        "process-digest",
        "process-exited-during-sample",
        "permission-denied",
        "operating-system",
        "invalid-operation",
        "pss-unavailable",
        "nvml-init",
        "nvml-device",
        "nvml-count",
        "nvml-processes",
        "nvml-memory-unavailable",
        "nvml-process-list-unstable",
        "root-identity",
        "sample-limit",
    }
)
UNREADABLE_PROCESS_ERRNOS = frozenset({errno.ENOENT, errno.ESRCH, errno.EACCES, errno.EPERM})


def unique_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("config-duplicate")
        result[key] = value
    return result


def safe_failure_code(error: BaseException) -> str:
    if str(error) in SAFE_FAILURE_CODES:
        return str(error)
    if isinstance(error, FileNotFoundError):
        return "process-exited-during-sample"
    if isinstance(error, PermissionError):
        return "permission-denied"
    if isinstance(error, OSError):
        if error.errno in {errno.ENOENT, errno.ESRCH}:
            return "process-exited-during-sample"
        if error.errno in {errno.EACCES, errno.EPERM}:
            return "permission-denied"
        if error.errno == errno.EINVAL:
            return "invalid-operation"
        return "operating-system"
    return "unknown"


def strict_config() -> dict[str, object]:
    raw = sys.stdin.buffer.readline(MAXIMUM_CONFIG_BYTES + 2)
    if not raw or len(raw) > MAXIMUM_CONFIG_BYTES or not raw.endswith(b"\n") or b"\r" in raw:
        raise ValueError("config-size")
    value = json.loads(raw.decode("utf-8"), object_pairs_hook=unique_object)
    if not isinstance(value, dict) or set(value) != {
        "schemaVersion",
        "backend",
        "rootPid",
        "deviceIndex",
        "expectedMainExecutableSha256",
    }:
        raise ValueError("config-shape")
    if value["schemaVersion"] != 3 or value["backend"] not in {"cpu", "cuda"}:
        raise ValueError("config-identity")
    if not isinstance(value["rootPid"], int) or isinstance(value["rootPid"], bool) or value["rootPid"] <= 1:
        raise ValueError("config-pid")
    expected_index = None if value["backend"] == "cpu" else 0
    if value["deviceIndex"] != expected_index:
        raise ValueError("config-device")
    digest = value["expectedMainExecutableSha256"]
    if not isinstance(digest, str) or len(digest) != 64 or any(character not in "0123456789abcdef" for character in digest):
        raise ValueError("config-identity")
    return value


def process_start_identity(pid: int) -> int | None:
    try:
        source = Path(f"/proc/{pid}/stat").read_text(encoding="ascii")
        tail = source[source.rindex(") ") + 2 :].split()
        if tail[0] in {"Z", "X", "x"}:
            return None
        return int(tail[19])
    except OSError as error:
        if error.errno in UNREADABLE_PROCESS_ERRNOS:
            return None
        raise
    except (ValueError, IndexError):
        return None


def process_executable_sha256(pid: int, expected_identity: int) -> str:
    if process_start_identity(pid) != expected_identity:
        raise RuntimeError("process-identity")
    descriptor = os.open(f"/proc/{pid}/exe", os.O_RDONLY | os.O_CLOEXEC)
    try:
        metadata = os.fstat(descriptor)
        if not stat.S_ISREG(metadata.st_mode):
            raise RuntimeError("process-digest")
        digest = hashlib.sha256()
        while True:
            chunk = os.read(descriptor, 1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    finally:
        os.close(descriptor)
    if process_start_identity(pid) != expected_identity:
        raise RuntimeError("process-identity")
    return digest.hexdigest()


def process_pss_bytes(pid: int) -> int:
    source = Path(f"/proc/{pid}/smaps_rollup").read_text(encoding="ascii")
    for line in source.splitlines():
        if line.startswith("Pss:"):
            fields = line.split()
            if len(fields) == 3 and fields[2] == "kB":
                return int(fields[1]) * 1024
            break
    raise RuntimeError("pss-unavailable")


def process_exit_confirmed(pid: int, expected_identity: int) -> bool:
    if process_start_identity(pid) != expected_identity:
        return True
    try:
        descriptor = os.pidfd_open(pid, 0)
    except ProcessLookupError:
        return process_start_identity(pid) != expected_identity
    try:
        if process_start_identity(pid) != expected_identity:
            return True
        poller = select.poll()
        poller.register(descriptor, select.POLLIN | select.POLLHUP | select.POLLERR)
        return bool(poller.poll(PSS_EXIT_CONFIRMATION_MILLISECONDS))
    finally:
        os.close(descriptor)


def stable_process_pss_bytes(pid: int, expected_identity: int) -> int | None:
    for attempt in range(PSS_READ_ATTEMPTS):
        identity = process_start_identity(pid)
        if identity is None:
            return None
        if identity != expected_identity:
            raise RuntimeError("pid-reuse")
        try:
            pss_bytes = process_pss_bytes(pid)
        except OSError as error:
            if error.errno not in {errno.ENOENT, errno.ESRCH}:
                raise
            if process_start_identity(pid) != expected_identity:
                return None
            if attempt + 1 == PSS_READ_ATTEMPTS:
                if process_exit_confirmed(pid, expected_identity):
                    return None
                raise
            os.sched_yield()
            continue
        if process_start_identity(pid) != expected_identity:
            raise RuntimeError("pid-reuse")
        return pss_bytes
    raise RuntimeError("pss-unavailable")


class NvmlProcessInfo(ctypes.Structure):
    _fields_ = [
        ("pid", ctypes.c_uint),
        ("usedGpuMemory", ctypes.c_ulonglong),
        ("gpuInstanceId", ctypes.c_uint),
        ("computeInstanceId", ctypes.c_uint),
    ]


class NvmlSampler:
    def __init__(self, device_index: int) -> None:
        self.library = ctypes.CDLL("libnvidia-ml.so.1")
        self.library.nvmlInit_v2.restype = ctypes.c_int
        self.library.nvmlShutdown.restype = ctypes.c_int
        self.library.nvmlDeviceGetHandleByIndex_v2.argtypes = [ctypes.c_uint, ctypes.POINTER(ctypes.c_void_p)]
        self.library.nvmlDeviceGetHandleByIndex_v2.restype = ctypes.c_int
        self.library.nvmlDeviceGetComputeRunningProcesses_v3.argtypes = [
            ctypes.c_void_p,
            ctypes.POINTER(ctypes.c_uint),
            ctypes.POINTER(NvmlProcessInfo),
        ]
        self.library.nvmlDeviceGetComputeRunningProcesses_v3.restype = ctypes.c_int
        if self.library.nvmlInit_v2() != NVML_SUCCESS:
            raise RuntimeError("nvml-init")
        self.initialized = True
        self.device = ctypes.c_void_p()
        if self.library.nvmlDeviceGetHandleByIndex_v2(device_index, ctypes.byref(self.device)) != NVML_SUCCESS:
            self.close()
            raise RuntimeError("nvml-device")

    def close(self) -> None:
        if getattr(self, "initialized", False):
            self.library.nvmlShutdown()
            self.initialized = False

    def owned_bytes(self, owned_pids: set[int]) -> int:
        for _attempt in range(NVML_QUERY_ATTEMPTS):
            count = ctypes.c_uint(0)
            status = self.library.nvmlDeviceGetComputeRunningProcesses_v3(self.device, ctypes.byref(count), None)
            if status not in {NVML_SUCCESS, NVML_ERROR_INSUFFICIENT_SIZE}:
                raise RuntimeError("nvml-count")
            capacity = max(count.value + NVML_PROCESS_HEADROOM, 1)
            records = (NvmlProcessInfo * capacity)()
            count = ctypes.c_uint(capacity)
            status = self.library.nvmlDeviceGetComputeRunningProcesses_v3(
                self.device, ctypes.byref(count), records
            )
            if status == NVML_ERROR_INSUFFICIENT_SIZE:
                continue
            if status != NVML_SUCCESS:
                raise RuntimeError("nvml-processes")
            total = 0
            for record in records[: count.value]:
                if record.pid in owned_pids:
                    if record.usedGpuMemory == NVML_VALUE_NOT_AVAILABLE:
                        raise RuntimeError("nvml-memory-unavailable")
                    total += int(record.usedGpuMemory)
            return total
        raise RuntimeError("nvml-process-list-unstable")


class EventChannel:
    def __init__(self, config: dict[str, object]) -> None:
        self.config = config
        self.buffer = bytearray()
        self.total_bytes = 0
        self.sequence = 0
        self.role_index = 0
        self.terminal = False
        self.closed = False
        self.registrations: dict[str, tuple[int, int, str]] = {}
        os.set_blocking(sys.stdin.fileno(), False)

    def drain(self) -> None:
        while True:
            try:
                chunk = os.read(sys.stdin.fileno(), 4096)
            except BlockingIOError:
                break
            if not chunk:
                self.closed = True
                break
            self.total_bytes += len(chunk)
            if self.total_bytes > MAXIMUM_EVENT_BYTES:
                raise ValueError("event-size")
            self.buffer.extend(chunk)
            while b"\n" in self.buffer:
                frame, _, remainder = self.buffer.partition(b"\n")
                self.buffer = bytearray(remainder)
                if not frame or len(frame) > MAXIMUM_FRAME_BYTES or b"\r" in frame:
                    raise ValueError("event-size")
                self.consume(frame)
        if len(self.buffer) > MAXIMUM_FRAME_BYTES:
            raise ValueError("event-size")
        if self.closed and self.buffer:
            raise ValueError("event-size")

    def consume(self, frame: bytes) -> None:
        value = json.loads(frame.decode("utf-8"), object_pairs_hook=unique_object)
        if not isinstance(value, dict) or value.get("schemaVersion") != 1:
            raise ValueError("event-shape")
        if value.get("sequence") != self.sequence or self.sequence >= MAXIMUM_EVENT_COUNT:
            raise ValueError("event-sequence")
        self.sequence += 1
        kind = value.get("kind")
        if kind == "role":
            self.consume_role(value)
        elif kind == "phase":
            if set(value) != {
                "schemaVersion",
                "kind",
                "sequence",
                "phaseId",
                "applicability",
                "durationNanoseconds",
            } or self.terminal:
                raise ValueError("event-shape")
        elif kind == "terminal":
            if set(value) != {"schemaVersion", "kind", "sequence", "status"} or value.get("status") != "success":
                raise ValueError("event-terminal")
            if self.terminal or self.role_index != len(ROLES):
                raise ValueError("event-terminal")
            self.terminal = True
        else:
            raise ValueError("event-shape")

    def consume_role(self, value: dict[str, object]) -> None:
        if self.terminal or set(value) != {
            "schemaVersion",
            "kind",
            "sequence",
            "role",
            "pid",
            "processStartIdentity",
            "executableSha256",
        }:
            raise ValueError("event-role")
        role = value.get("role")
        pid = value.get("pid")
        identity_text = value.get("processStartIdentity")
        digest = value.get("executableSha256")
        if (
            self.role_index >= len(ROLES)
            or role != ROLES[self.role_index]
            or not isinstance(pid, int)
            or isinstance(pid, bool)
            or pid <= 1
            or not isinstance(identity_text, str)
            or not identity_text.isdecimal()
            or not isinstance(digest, str)
            or len(digest) != 64
            or any(character not in "0123456789abcdef" for character in digest)
            or any(registered_pid == pid for registered_pid, _, _ in self.registrations.values())
        ):
            raise ValueError("event-role")
        identity = int(identity_text)
        if role == "main" and pid != int(self.config["rootPid"]):
            raise ValueError("event-role")
        if role == "main" and digest != self.config["expectedMainExecutableSha256"]:
            raise ValueError("process-digest")
        if process_start_identity(pid) != identity:
            raise RuntimeError("process-identity")
        if process_executable_sha256(pid, identity) != digest:
            raise RuntimeError("process-digest")
        self.registrations[str(role)] = (pid, identity, digest)
        self.role_index += 1

    def complete(self) -> bool:
        return self.closed and self.terminal and self.role_index == len(ROLES)


def signal_ready() -> None:
    with os.fdopen(READINESS_FD, "wb", buffering=0, closefd=True) as control:
        control.write(READINESS_FRAME)


def sample(config: dict[str, object], channel: EventChannel, nvml: NvmlSampler | None) -> dict[str, object]:
    backend = str(config["backend"])
    role_peaks = {role: 0 for role in ROLES}
    gpu_peak = 0
    settled = 0
    start = time.monotonic_ns()
    next_sample = start
    for _index in range(MAXIMUM_SAMPLES):
        now = time.monotonic_ns()
        if now < next_sample:
            time.sleep((next_sample - now) / 1_000_000_000)
        channel.drain()
        live_pids: set[int] = set()
        role_memory = {role: 0 for role in ROLES}
        for role, (pid, identity, _digest) in channel.registrations.items():
            pss_bytes = stable_process_pss_bytes(pid, identity)
            if pss_bytes is not None:
                live_pids.add(pid)
                role_memory[role] = pss_bytes
                role_peaks[role] = max(role_peaks[role], pss_bytes)
        vram_bytes = 0 if nvml is None else nvml.owned_bytes(live_pids)
        gpu_peak = max(gpu_peak, vram_bytes)
        zero = not live_pids and not any(role_memory.values()) and vram_bytes == 0
        settled = settled + 1 if channel.complete() and zero else 0
        if settled >= SETTLED_SAMPLES:
            break
        next_sample += INTERVAL_NS
    else:
        raise RuntimeError("sample-limit")
    if not channel.complete():
        raise RuntimeError("event-incomplete")
    return {
        "schemaVersion": 3,
        "sampleIntervalMilliseconds": 100,
        "ramAlgorithm": "proc-smaps-rollup-pss-registered-role-start-identity-v1",
        "vramAlgorithm": "notApplicable" if backend == "cpu" else "nvml-compute-running-processes-v3-registered-pids-v1",
        "resources": {
            "mainProcessPeakRss": role_peaks["main"],
            "guardProcessPeakRss": role_peaks["guard"],
            "workerProcessPeakRss": role_peaks["worker"],
            "gpuPeakVram": "notApplicable" if backend == "cpu" else gpu_peak,
        },
        "roleRegistrations": [
            {
                "role": role,
                "pid": channel.registrations[role][0],
                "processStartIdentity": str(channel.registrations[role][1]),
                "executableSha256": channel.registrations[role][2],
            }
            for role in ROLES
        ],
        "processSettlementProof": "ownedProcessTreeSettled",
        "settledZeroOwnershipSamples": SETTLED_SAMPLES,
        "unownedProcessAttribution": 0,
        "unownedGpuAttribution": "notApplicable" if backend == "cpu" else 0,
        "identityChanges": 0,
        "lateRoleRegistrations": 0,
        "liveOwnedProcessesAfterSettlement": 0,
    }


def main() -> None:
    signal.signal(signal.SIGINT, signal.SIG_IGN)
    config = strict_config()
    if process_start_identity(int(config["rootPid"])) is None:
        raise RuntimeError("root-identity")
    nvml = NvmlSampler(int(config["deviceIndex"])) if config["backend"] == "cuda" else None
    try:
        channel = EventChannel(config)
        signal_ready()
        result = sample(config, channel, nvml)
    finally:
        if nvml is not None:
            nvml.close()
    sys.stdout.write(json.dumps(result, separators=(",", ":"), sort_keys=True) + "\n")


if __name__ == "__main__":
    try:
        main()
    except BaseException as error:
        sys.stderr.write(f"LOCAL_WHISPER_RESOURCE_SAMPLING_FAILED:{safe_failure_code(error)}\n")
        raise SystemExit(1)
