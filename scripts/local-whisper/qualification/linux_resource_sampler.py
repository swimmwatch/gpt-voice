#!/usr/bin/env python3
"""Samples only an exact Linux-owned process tree and optional NVIDIA allocation."""

from __future__ import annotations

import ctypes
import errno
import json
import os
from pathlib import Path
import signal
import sys
import time

INTERVAL_NS = 100_000_000
MAXIMUM_SAMPLES = 36_000
SETTLED_SAMPLES = 10
NVML_SUCCESS = 0
NVML_ERROR_INSUFFICIENT_SIZE = 7
NVML_VALUE_NOT_AVAILABLE = (1 << 64) - 1
NVML_QUERY_ATTEMPTS = 4
NVML_PROCESS_HEADROOM = 16
READINESS_FD = 3
READINESS_FRAME = b"READY\n"
SAFE_FAILURE_CODES = frozenset(
    {
        "config-size",
        "config-duplicate",
        "config-shape",
        "config-identity",
        "config-pid",
        "config-device",
        "pid-reuse",
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


class NvmlProcessInfo(ctypes.Structure):
    _fields_ = [
        ("pid", ctypes.c_uint),
        ("usedGpuMemory", ctypes.c_ulonglong),
        ("gpuInstanceId", ctypes.c_uint),
        ("computeInstanceId", ctypes.c_uint),
    ]


def strict_config() -> dict[str, object]:
    raw = sys.stdin.buffer.read(4097)
    if not raw or len(raw) > 4096:
        raise ValueError("config-size")

    def unique(pairs: list[tuple[str, object]]) -> dict[str, object]:
        result: dict[str, object] = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("config-duplicate")
            result[key] = value
        return result

    value = json.loads(raw.decode("utf-8"), object_pairs_hook=unique)
    if not isinstance(value, dict) or set(value) != {"schemaVersion", "backend", "rootPid", "deviceIndex"}:
        raise ValueError("config-shape")
    if value["schemaVersion"] != 1 or value["backend"] not in {"cpu", "cuda"}:
        raise ValueError("config-identity")
    if not isinstance(value["rootPid"], int) or isinstance(value["rootPid"], bool) or value["rootPid"] <= 1:
        raise ValueError("config-pid")
    expected_index = None if value["backend"] == "cpu" else 0
    if value["deviceIndex"] != expected_index:
        raise ValueError("config-device")
    return value


def process_start_identity(pid: int) -> int | None:
    try:
        source = Path(f"/proc/{pid}/stat").read_text(encoding="ascii")
        tail = source[source.rindex(") ") + 2 :].split()
        if tail[0] in {"Z", "X", "x"}:
            return None
        return int(tail[19])
    except (FileNotFoundError, PermissionError, ValueError, IndexError):
        return None


def child_pids(pid: int) -> list[int]:
    children: set[int] = set()
    task_root = Path(f"/proc/{pid}/task")
    try:
        tasks = list(task_root.iterdir())
    except (FileNotFoundError, PermissionError):
        return []
    for task in tasks:
        try:
            values = (task / "children").read_text(encoding="ascii").split()
            children.update(int(value) for value in values)
        except (FileNotFoundError, PermissionError, ValueError):
            continue
    return sorted(children)


def discover_tree(root_pid: int, identities: dict[int, int]) -> None:
    pending = [root_pid]
    visited: set[int] = set()
    while pending:
        pid = pending.pop()
        if pid in visited:
            continue
        visited.add(pid)
        identity = process_start_identity(pid)
        if identity is None:
            continue
        previous = identities.setdefault(pid, identity)
        if previous != identity:
            raise RuntimeError("pid-reuse")
        pending.extend(child_pids(pid))


def process_pss_bytes(pid: int) -> int:
    source = Path(f"/proc/{pid}/smaps_rollup").read_text(encoding="ascii")
    for line in source.splitlines():
        if line.startswith("Pss:"):
            fields = line.split()
            if len(fields) != 3 or fields[2] != "kB":
                break
            return int(fields[1]) * 1024
    raise RuntimeError("pss-unavailable")


def owned_process_memory(identities: dict[int, int]) -> tuple[list[int], int]:
    owned: list[int] = []
    ram_bytes = 0
    for pid, expected_identity in sorted(identities.items()):
        if process_start_identity(pid) != expected_identity:
            continue
        try:
            pss_bytes = process_pss_bytes(pid)
        except OSError:
            if process_start_identity(pid) is None:
                continue
            raise
        if process_start_identity(pid) != expected_identity:
            continue
        owned.append(pid)
        ram_bytes += pss_bytes
    return owned, ram_bytes


def process_has_gpu_runtime(pid: int) -> bool:
    try:
        mappings = Path(f"/proc/{pid}/maps").read_text(encoding="utf-8", errors="strict").lower()
    except (FileNotFoundError, PermissionError, UnicodeError):
        return False
    return any(name in mappings for name in ("libcuda", "libcudart", "libnvidia"))


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
            status = self.library.nvmlDeviceGetComputeRunningProcesses_v3(
                self.device, ctypes.byref(count), None
            )
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


def prepare_sampler(config: dict[str, object]) -> tuple[dict[int, int], NvmlSampler | None]:
    root_pid = int(config["rootPid"])
    backend = str(config["backend"])
    identities: dict[int, int] = {}
    discover_tree(root_pid, identities)
    if root_pid not in identities:
        raise RuntimeError("root-identity")
    nvml = NvmlSampler(int(config["deviceIndex"])) if backend == "cuda" else None
    return identities, nvml


def signal_ready() -> None:
    with os.fdopen(READINESS_FD, "wb", buffering=0, closefd=True) as control:
        remaining = memoryview(READINESS_FRAME)
        while remaining:
            written = control.write(remaining)
            if written is None or written <= 0:
                raise OSError("readiness-write")
            remaining = remaining[written:]


def sample(
    config: dict[str, object], identities: dict[int, int], nvml: NvmlSampler | None
) -> dict[str, object]:
    root_pid = int(config["rootPid"])
    backend = str(config["backend"])
    samples: list[dict[str, object]] = []
    start = time.monotonic_ns()
    next_sample = start
    settled = 0
    cpu_gpu_initialized = False
    for _index in range(MAXIMUM_SAMPLES):
        now = time.monotonic_ns()
        if now < next_sample:
            time.sleep((next_sample - now) / 1_000_000_000)
        observed = time.monotonic_ns()
        discover_tree(root_pid, identities)
        owned, ram_bytes = owned_process_memory(identities)
        owned_set = set(owned)
        if backend == "cpu" and any(process_has_gpu_runtime(pid) for pid in owned):
            cpu_gpu_initialized = True
        vram_bytes: int | str = "notApplicable" if nvml is None else nvml.owned_bytes(owned_set)
        samples.append(
            {
                "elapsedNanoseconds": observed - start,
                "ownedProcessCount": len(owned),
                "ramBytes": ram_bytes,
                "vramBytes": vram_bytes,
            }
        )
        zero = len(owned) == 0 and ram_bytes == 0 and (vram_bytes == 0 or vram_bytes == "notApplicable")
        settled = settled + 1 if zero else 0
        if settled >= SETTLED_SAMPLES:
            break
        next_sample += INTERVAL_NS
    else:
        raise RuntimeError("sample-limit")
    return {
        "schemaVersion": 2,
        "sampleIntervalMilliseconds": 100,
        "ramAlgorithm": "proc-smaps-rollup-pss-owned-start-identity-v1",
        "vramAlgorithm": "notApplicable" if backend == "cpu" else "nvml-compute-running-processes-v3-owned-pids-v1",
        "cpuGpuInitialization": "absent" if backend == "cpu" and not cpu_gpu_initialized else "notApplicable",
        "samples": samples,
    }


def main() -> None:
    signal.signal(signal.SIGINT, signal.SIG_IGN)
    config = strict_config()
    identities, nvml = prepare_sampler(config)
    try:
        signal_ready()
        result = sample(config, identities, nvml)
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
