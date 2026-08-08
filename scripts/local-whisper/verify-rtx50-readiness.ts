import { readFile } from 'node:fs/promises';

const REQUIRED_MARKERS = Object.freeze([
  Object.freeze({
    path: 'src/main/localWhisper/capability/NvidiaSmiHostInventory.ts',
    markers: Object.freeze([
      "'/usr/bin/nvidia-smi'",
      "'--query-gpu=pci.bus_id,compute_cap,driver_version,memory.total'",
      'NVIDIA_SMI_MAXIMUM_OUTPUT_CHARACTERS',
      'NVIDIA_SMI_MAXIMUM_DEVICE_COUNT',
    ]),
  }),
  Object.freeze({
    path: 'src/main/localWhisper/capability/NvidiaCudaRuntimeApplicability.ts',
    markers: Object.freeze(['sm_120a-real', 'minimumDriverVersion', 'minimumTotalVramBytes']),
  }),
  Object.freeze({
    path: 'src/main/localWhisper/composition/createProductionLocalWhisperEnvironment.ts',
    markers: Object.freeze(['readNvidiaInventory', 'NvidiaCudaRuntimeApplicability', 'rendererArtifacts']),
  }),
]);

async function main(): Promise<void> {
  for (const contract of REQUIRED_MARKERS) {
    const source = await readFile(contract.path, 'utf8');
    if (!contract.markers.every((marker) => source.includes(marker))) {
      throw new Error(`RTX 50 readiness contract missing: ${contract.path}`);
    }
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'RTX 50 readiness verification failed'}\n`);
  process.exitCode = 1;
});
