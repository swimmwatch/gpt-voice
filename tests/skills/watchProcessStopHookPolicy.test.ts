import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import * as path from 'node:path';

const WORKSPACE_PATH = path.resolve(__dirname, '../..');
const HOOKS_PATH = path.join(WORKSPACE_PATH, '.codex/hooks.json');
const STOP_HOOK_PATH = path.join(WORKSPACE_PATH, '.agents/skills/watch-process/scripts/process-watch-stop-hook.mjs');
const STOP_HOOK_LIBRARY_ROOT = path.join(WORKSPACE_PATH, '.agents/skills/watch-process/scripts/lib');
const STOP_HOOK_IMPLEMENTATION_PATH = path.join(STOP_HOOK_LIBRARY_ROOT, 'process-watch-stop-hook.mjs');
const OPERATOR_PATH = path.join(STOP_HOOK_LIBRARY_ROOT, 'process-watch-operator.mjs');
const SELECTION_STORE_PATH = path.join(STOP_HOOK_LIBRARY_ROOT, 'process-watch-selection-store.mjs');
const TERMINAL_WAITER_PATH = path.join(STOP_HOOK_LIBRARY_ROOT, 'process-watch-terminal-waiter.mjs');
const HOOK_TIMEOUT_SECONDS = 604_920;

interface HookHandler {
  readonly async: boolean;
  readonly command: string;
  readonly commandWindows: string;
  readonly statusMessage: string;
  readonly timeout: number;
  readonly type: string;
}

function hookHandler(): HookHandler {
  const config = JSON.parse(readFileSync(HOOKS_PATH, 'utf8')) as {
    readonly hooks?: Record<string, readonly { readonly hooks?: readonly HookHandler[] }[]>;
  };
  assert.deepEqual(Object.keys(config.hooks ?? {}), ['Stop']);
  const groups = config.hooks?.Stop;
  assert.ok(groups);
  assert.equal(groups.length, 1);
  assert.deepEqual(Object.keys(groups[0] ?? {}).sort(), ['hooks']);
  const handlers = groups[0]?.hooks;
  if (!handlers || handlers.length !== 1) throw new Error('Expected exactly one Stop-hook handler');
  const handler = handlers[0];
  if (!handler) throw new Error('Expected a Stop-hook handler');
  return handler;
}

describe('watch-process Stop-hook policy', () => {
  it('registers exactly one synchronous, project-local Stop handler with a declared ceiling', () => {
    const handler = hookHandler();

    assert.equal(existsSync(STOP_HOOK_PATH), true);
    assert.equal(handler.type, 'command');
    assert.equal(handler.async, false);
    assert.equal(handler.timeout, HOOK_TIMEOUT_SECONDS);
    assert.equal(handler.statusMessage, 'Waiting for process watch');
    assert.match(handler.command, /^node "\$\(git rev-parse --show-toplevel\)\//u);
    assert.match(handler.command, /process-watch-stop-hook\.mjs"$/u);
    assert.match(handler.commandWindows, /^powershell -NoProfile -NonInteractive -Command /u);
    assert.match(handler.commandWindows, /git rev-parse --show-toplevel/u);
    assert.match(handler.commandWindows, /process-watch-stop-hook\.mjs/u);
  });

  it('keeps fixed host commands independent of global paths, user input, and asynchronous dispatch', () => {
    const handler = hookHandler();
    const commands = `${handler.command}\n${handler.commandWindows}`;

    assert.doesNotMatch(commands, /(?:~|%USERPROFILE%|\$HOME|[A-Z]:\\Users|\/home\/|config\.toml)/iu);
    assert.doesNotMatch(commands, /(?:scenario|target|timeout|last_assistant_message|session_id)/iu);
    assert.doesNotMatch(JSON.stringify(handler), /"async":true/u);
  });

  it('shares one model-free terminal waiter and keeps current-watch selection separate from authority', () => {
    const hook = readFileSync(STOP_HOOK_IMPLEMENTATION_PATH, 'utf8');
    const operator = readFileSync(OPERATOR_PATH, 'utf8');
    const selectionStore = readFileSync(SELECTION_STORE_PATH, 'utf8');

    assert.equal(existsSync(TERMINAL_WAITER_PATH), true);
    assert.match(hook, /new ProcessWatchTerminalWaiter/u);
    assert.match(operator, /new ProcessWatchTerminalWaiter/u);
    assert.match(operator, /async continuation\(/u);
    assert.match(operator, /async wait\(/u);
    assert.match(selectionStore, /selection-only pointer/u);
    assert.doesNotMatch(hook, /if \(input\.stopHookActive/u);
    assert.match(operator, /mode: 'repair-restart'/u);
    assert.match(operator, /await this\.#selectCurrentWatch\(record\.watchId\)/u);
  });
});
