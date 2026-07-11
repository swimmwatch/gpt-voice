import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDirectory = path.join(rootDirectory, 'dist');

export async function cleanDistDirectory(directory = distDirectory) {
  await rm(directory, { force: true, recursive: true });
  await mkdir(directory, { recursive: true });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await cleanDistDirectory();
  console.log('Cleaned dist output');
}
