import { lstatSync } from 'node:fs';
import path from 'node:path';

const COREPACK_ENTRY_RELATIVE_PATH = ['node_modules', 'corepack', 'dist', 'corepack.js'];

/** Resolves Corepack without asking Windows to execute a command shim through a shell. */
export function resolveCorepackCommand(platform, nodeExecutable, inspectEntry = lstatSync) {
  const platformPath = platform === 'win32' ? path.win32 : path.posix;
  if (typeof nodeExecutable !== 'string' || !platformPath.isAbsolute(nodeExecutable)) {
    throw new Error('COREPACK_NODE_EXECUTABLE_INVALID');
  }
  if (platform !== 'win32') {
    return Object.freeze({ executable: 'corepack', argumentPrefix: Object.freeze([]) });
  }
  const entry = platformPath.join(platformPath.dirname(nodeExecutable), ...COREPACK_ENTRY_RELATIVE_PATH);
  let identity;
  try {
    identity = inspectEntry(entry);
  } catch {
    throw new Error('COREPACK_ENTRY_UNAVAILABLE');
  }
  if (!identity.isFile() || identity.isSymbolicLink()) {
    throw new Error('COREPACK_ENTRY_UNAVAILABLE');
  }
  return Object.freeze({
    executable: nodeExecutable,
    argumentPrefix: Object.freeze([entry]),
  });
}
