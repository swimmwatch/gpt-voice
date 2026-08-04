from __future__ import annotations

import errno
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import MagicMock, patch


MODULE_PATH = (
    Path(__file__).resolve().parents[4]
    / "scripts"
    / "local-whisper"
    / "qualification"
    / "linux_resource_sampler.py"
)
SPEC = importlib.util.spec_from_file_location("local_whisper_linux_resource_sampler", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("resource sampler test module is unavailable")
SAMPLER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SAMPLER)


class FakeNvmlLibrary:
    def __init__(self) -> None:
        self.data_calls = 0

    def nvmlDeviceGetComputeRunningProcesses_v3(self, _device, count_pointer, records) -> int:
        if records is None:
            count_pointer._obj.value = 1
            return SAMPLER.NVML_ERROR_INSUFFICIENT_SIZE
        self.data_calls += 1
        if self.data_calls == 1:
            count_pointer._obj.value = 2
            return SAMPLER.NVML_ERROR_INSUFFICIENT_SIZE
        count_pointer._obj.value = 1
        records[0].pid = 123
        records[0].usedGpuMemory = 456
        return SAMPLER.NVML_SUCCESS


class LinuxResourceSamplerTest(unittest.TestCase):
    def test_readiness_frame_is_exact_and_descriptor_is_closed(self) -> None:
        control = MagicMock()
        control.__enter__.return_value = control
        control.write.return_value = len(SAMPLER.READINESS_FRAME)
        with patch.object(SAMPLER.os, "fdopen", return_value=control) as fdopen:
            SAMPLER.signal_ready()

        fdopen.assert_called_once_with(SAMPLER.READINESS_FD, "wb", buffering=0, closefd=True)
        control.write.assert_called_once()
        self.assertEqual(bytes(control.write.call_args.args[0]), b"READY\n")
        control.__exit__.assert_called_once()

    def test_nvml_process_registration_race_is_retried(self) -> None:
        sampler = object.__new__(SAMPLER.NvmlSampler)
        sampler.library = FakeNvmlLibrary()
        sampler.device = None
        self.assertEqual(sampler.owned_bytes({123}), 456)
        self.assertEqual(sampler.library.data_calls, 2)

    def test_pss_race_ignores_only_a_proven_exited_process(self) -> None:
        with (
            patch.object(SAMPLER, "process_start_identity", side_effect=[42, None]),
            patch.object(
                SAMPLER,
                "process_pss_bytes",
                side_effect=FileNotFoundError(errno.ENOENT, "missing"),
            ),
        ):
            self.assertEqual(SAMPLER.owned_process_memory({123: 42}), ([], 0))

        with (
            patch.object(
                SAMPLER,
                "process_start_identity",
                side_effect=[42] * (SAMPLER.PSS_READ_ATTEMPTS * 2),
            ),
            patch.object(
                SAMPLER,
                "process_pss_bytes",
                side_effect=FileNotFoundError(errno.ENOENT, "missing"),
            ),
            patch.object(SAMPLER, "process_exit_confirmed", return_value=False),
            patch.object(SAMPLER.os, "sched_yield"),
        ):
            with self.assertRaises(FileNotFoundError):
                SAMPLER.owned_process_memory({123: 42})

    def test_pss_race_accepts_pidfd_confirmed_process_exit(self) -> None:
        with (
            patch.object(
                SAMPLER,
                "process_start_identity",
                side_effect=[42] * (SAMPLER.PSS_READ_ATTEMPTS * 2),
            ),
            patch.object(
                SAMPLER,
                "process_pss_bytes",
                side_effect=FileNotFoundError(errno.ENOENT, "missing"),
            ),
            patch.object(SAMPLER, "process_exit_confirmed", return_value=True) as exit_confirmed,
            patch.object(SAMPLER.os, "sched_yield"),
        ):
            self.assertEqual(SAMPLER.owned_process_memory({123: 42}), ([], 0))
        exit_confirmed.assert_called_once_with(123, 42)

    def test_pidfd_confirmation_waits_for_the_same_process_to_exit(self) -> None:
        poller = MagicMock()
        poller.poll.return_value = [(7, SAMPLER.select.POLLIN)]
        with (
            patch.object(SAMPLER, "process_start_identity", side_effect=[42, 42]),
            patch.object(SAMPLER.os, "pidfd_open", return_value=7) as pidfd_open,
            patch.object(SAMPLER.select, "poll", return_value=poller),
            patch.object(SAMPLER.os, "close") as close,
        ):
            self.assertTrue(SAMPLER.process_exit_confirmed(123, 42))

        pidfd_open.assert_called_once_with(123, 0)
        poller.register.assert_called_once_with(
            7,
            SAMPLER.select.POLLIN | SAMPLER.select.POLLHUP | SAMPLER.select.POLLERR,
        )
        poller.poll.assert_called_once_with(SAMPLER.PSS_EXIT_CONFIRMATION_MILLISECONDS)
        close.assert_called_once_with(7)

    def test_pss_race_retries_only_while_process_identity_is_stable(self) -> None:
        with (
            patch.object(SAMPLER, "process_start_identity", side_effect=[42, 42, 42, 42]),
            patch.object(
                SAMPLER,
                "process_pss_bytes",
                side_effect=[FileNotFoundError(errno.ENOENT, "missing"), 4096],
            ),
            patch.object(SAMPLER.os, "sched_yield") as sched_yield,
        ):
            self.assertEqual(SAMPLER.owned_process_memory({123: 42}), ([123], 4096))
        sched_yield.assert_called_once_with()

    def test_procfs_esrch_is_treated_as_a_disappearing_process(self) -> None:
        process_gone = ProcessLookupError(errno.ESRCH, "process gone")
        with patch.object(SAMPLER.Path, "read_text", side_effect=process_gone):
            self.assertIsNone(SAMPLER.process_start_identity(123))
            self.assertFalse(SAMPLER.process_has_gpu_runtime(123))

        with patch.object(SAMPLER.Path, "iterdir", side_effect=process_gone):
            self.assertEqual(SAMPLER.child_pids(123), [])

    def test_failure_codes_never_include_exception_details(self) -> None:
        self.assertEqual(SAMPLER.safe_failure_code(FileNotFoundError("/private/path")), "process-exited-during-sample")
        self.assertEqual(SAMPLER.safe_failure_code(RuntimeError("private detail")), "unknown")


if __name__ == "__main__":
    unittest.main()
