from __future__ import annotations

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
            patch.object(SAMPLER, "process_pss_bytes", side_effect=FileNotFoundError()),
        ):
            self.assertEqual(SAMPLER.owned_process_memory({123: 42}), ([], 0))

        with (
            patch.object(SAMPLER, "process_start_identity", side_effect=[42, 42]),
            patch.object(SAMPLER, "process_pss_bytes", side_effect=FileNotFoundError()),
        ):
            with self.assertRaises(FileNotFoundError):
                SAMPLER.owned_process_memory({123: 42})

    def test_failure_codes_never_include_exception_details(self) -> None:
        self.assertEqual(SAMPLER.safe_failure_code(FileNotFoundError("/private/path")), "process-exited-during-sample")
        self.assertEqual(SAMPLER.safe_failure_code(RuntimeError("private detail")), "unknown")


if __name__ == "__main__":
    unittest.main()
