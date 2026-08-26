import { Buffer } from 'node:buffer';
import process from 'node:process';
import * as path from 'node:path';
import { TextDecoder } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ProcessWatchStopHook } from './lib/process-watch-stop-hook.mjs';
import { ProcessWatchStopHookRepository } from './lib/process-watch-stop-hook-repository.mjs';

const MAX_HOOK_INPUT_BYTES = 65_536;
const NEUTRAL_OUTPUT = Object.freeze({});

function pathsEqual(left, right) {
  return process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
}

async function readJsonInput(input) {
  const chunks = [];
  let byteLength = 0;
  try {
    for await (const chunk of input) {
      const bytes = Buffer.from(chunk);
      byteLength += bytes.byteLength;
      if (byteLength > MAX_HOOK_INPUT_BYTES) return null;
      chunks.push(bytes);
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } catch {
    return null;
  }
}

function writeJsonOutput(output, value) {
  try {
    output.write(`${JSON.stringify(value)}\n`);
  } catch {
    // Hook output transport is best-effort; never print diagnostics or input data.
  }
}

/** Derives the tracked project root and rejects a relocated look-alike script. */
export function deriveProcessWatchWorkspaceRoot({ scriptUrl = import.meta.url } = {}) {
  const scriptPath = path.resolve(fileURLToPath(scriptUrl));
  const workspaceRoot = path.resolve(path.dirname(scriptPath), '..', '..', '..', '..');
  const expectedPath = path.join(
    workspaceRoot,
    '.agents',
    'skills',
    'watch-process',
    'scripts',
    'process-watch-stop-hook.mjs',
  );
  if (!pathsEqual(scriptPath, expectedPath)) throw new Error('invalid-stop-hook-script-path');
  return workspaceRoot;
}

/** Runs one Stop-hook invocation and always emits bounded JSON rather than diagnostics. */
export async function runProcessWatchStopHook({
  arguments_ = process.argv.slice(2),
  input = process.stdin,
  output = process.stdout,
} = {}) {
  const controller = new globalThis.AbortController();
  const abort = () => controller.abort();
  process.once('SIGINT', abort);
  process.once('SIGTERM', abort);
  try {
    if (!Array.isArray(arguments_) || arguments_.length !== 0) {
      writeJsonOutput(output, NEUTRAL_OUTPUT);
      return NEUTRAL_OUTPUT;
    }
    const workspaceRoot = deriveProcessWatchWorkspaceRoot();
    const hook = new ProcessWatchStopHook({ repository: new ProcessWatchStopHookRepository({ workspaceRoot }) });
    const result = await hook.handle(await readJsonInput(input), { signal: controller.signal });
    writeJsonOutput(output, result);
    return result;
  } catch {
    writeJsonOutput(output, NEUTRAL_OUTPUT);
    return NEUTRAL_OUTPUT;
  } finally {
    process.removeListener('SIGINT', abort);
    process.removeListener('SIGTERM', abort);
  }
}

function isMainModule() {
  return typeof process.argv[1] === 'string' && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
}

if (isMainModule()) {
  void runProcessWatchStopHook();
}
