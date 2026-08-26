import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { connect } from 'node:net';
import { isAbsolute, resolve } from 'node:path';
import process from 'node:process';

import { runWithRequiredCleanup } from './network-denied-build-core.mjs';

const NETWORK_PROBE_MARKER = 'LOCAL_WHISPER_NETWORK_DENIED';
const POWERSHELL_RESOLUTION_MARKER = 'LOCAL_WHISPER_POWERSHELL_RESOLVED';
const NETWORK_PROBE_ADDRESS = '1.1.1.1';
const NETWORK_PROBE_PORT = 443;
const NETWORK_PROBE_TIMEOUT_MS = 5_000;
const CLEANUP_SELF_TEST_ARGUMENT = '--assert-cleanup-idempotent';

function fail(message) {
  throw new Error(`Windows network-denied native build failed: ${message}`);
}

function parseArguments(arguments_) {
  const separator = arguments_.indexOf('--');
  if (separator < 0 || separator === arguments_.length - 1) fail('command separator is missing');
  const options = arguments_.slice(0, separator);
  const command = arguments_.slice(separator + 1);
  const values = new Map();
  for (const option of options) {
    const match = /^--([a-z-]+)=(.+)$/u.exec(option);
    if (!match) fail(`option is invalid: ${option}`);
    const [, key, value] = match;
    const entries = values.get(key) ?? [];
    entries.push(value);
    values.set(key, entries);
  }
  const one = (key) => {
    const valuesForKey = values.get(key) ?? [];
    if (valuesForKey.length !== 1) fail(`option must be present exactly once: ${key}`);
    return valuesForKey[0];
  };
  const allowedPrograms = values.get('allowed-program') ?? [];
  if (allowedPrograms.length === 0) fail('at least one allowed program is required');
  return Object.freeze({
    allowedPrograms: Object.freeze(allowedPrograms),
    attemptRoot: one('attempt-root'),
    command: command[0],
    commandArguments: Object.freeze(command.slice(1)),
  });
}

function requireRegularExecutable(path, label) {
  if (!isAbsolute(path) || !existsSync(path)) fail(`${label} is missing or not absolute`);
  const metadata = lstatSync(path);
  if (!metadata.isFile() || metadata.isSymbolicLink()) fail(`${label} is not a regular file`);
  return realpathSync(path);
}

function assertAttemptRoot(attemptRoot) {
  if (!isAbsolute(attemptRoot) || resolve(attemptRoot) === resolve(attemptRoot, '..')) {
    fail('attempt root is invalid');
  }
}

function powershellLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function resolveWindowsPowerShellPath() {
  const windowsRoot = process.env.SystemRoot ?? process.env.WINDIR;
  if (typeof windowsRoot !== 'string' || !isAbsolute(windowsRoot)) {
    fail('Windows root is unavailable for PowerShell resolution');
  }
  return requireRegularExecutable(
    resolve(windowsRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    'Windows PowerShell',
  );
}

function runPowerShell(script, label) {
  const result = spawnSync(
    resolveWindowsPowerShellPath(),
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script],
    {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
      shell: false,
      windowsHide: true,
    },
  );
  if (result.error || result.status !== 0) {
    const errorId = /LOCAL_WHISPER_FIREWALL_ERROR_ID=([\w,.-]+)/u.exec(String(result.stderr ?? ''))?.[1];
    fail(`${label} could not be enforced${errorId ? ` (${errorId})` : ''}`);
  }
}

function firewallErrorHandler() {
  return [
    '} catch {',
    "  $safe = ([string]$_.FullyQualifiedErrorId) -replace '[^A-Za-z0-9,._-]', '_'",
    '  [Console]::Error.WriteLine("LOCAL_WHISPER_FIREWALL_ERROR_ID=$safe")',
    '  exit 1',
    '}',
  ];
}

function addFirewallRules(ruleGroup, programs) {
  const command = [
    "$ErrorActionPreference = 'Stop'",
    `$group = ${powershellLiteral(ruleGroup)}`,
    `$programs = @(${programs.map(powershellLiteral).join(',')})`,
    'try {',
    'foreach ($program in $programs) {',
    '  New-NetFirewallRule -DisplayName $group -Group $group -Direction Outbound -Action Block -Program $program -Profile Any | Out-Null',
    '}',
    ...firewallErrorHandler(),
  ].join(';');
  runPowerShell(command, 'Windows Firewall isolation setup');
}

function removeFirewallRules(ruleGroup) {
  const command = [
    "$ErrorActionPreference = 'Stop'",
    `$group = ${powershellLiteral(ruleGroup)}`,
    'try {',
    'Get-NetFirewallRule -Group $group -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction Stop',
    ...firewallErrorHandler(),
  ].join(';');
  runPowerShell(command, 'Windows Firewall isolation cleanup');
}

function requireDeniedProbe(attemptRoot) {
  const result = spawnSync(process.execPath, [import.meta.filename, '--assert-network-denied'], {
    cwd: attemptRoot,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 1024 * 1024,
    shell: false,
    windowsHide: true,
  });
  if (result.error || result.status === 0 || String(result.stdout ?? '').trim() !== NETWORK_PROBE_MARKER) {
    fail('same-boundary network probe did not prove denied egress');
  }
}

function runNetworkProbe() {
  const socket = connect({ host: NETWORK_PROBE_ADDRESS, port: NETWORK_PROBE_PORT });
  let settled = false;
  const denied = () => {
    if (settled) return;
    settled = true;
    socket.destroy();
    process.stdout.write(`${NETWORK_PROBE_MARKER}\n`);
    process.exitCode = 1;
  };
  socket.setTimeout(NETWORK_PROBE_TIMEOUT_MS, denied);
  socket.once('error', denied);
  socket.once('connect', () => {
    if (settled) return;
    settled = true;
    socket.destroy();
    process.exitCode = 0;
  });
}

function runBuild(command, commandArguments, attemptRoot) {
  const result = spawnSync(command, commandArguments, {
    cwd: attemptRoot,
    env: process.env,
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) fail('isolated native build command failed');
}

function main() {
  if (process.platform !== 'win32') fail('Windows Firewall boundary requires a Windows host');
  if (process.argv.length === 3 && process.argv[2] === '--assert-powershell-resolved') {
    resolveWindowsPowerShellPath();
    process.stdout.write(`${POWERSHELL_RESOLUTION_MARKER}\n`);
    return;
  }
  if (process.argv.length === 3 && process.argv[2] === CLEANUP_SELF_TEST_ARGUMENT) {
    removeFirewallRules(`GPTVoice-LocalWhisper-Cleanup-Self-Test-${process.pid}-${Date.now()}`);
    return;
  }
  if (process.argv.length === 3 && process.argv[2] === '--assert-network-denied') {
    runNetworkProbe();
    return;
  }
  const parsed = parseArguments(process.argv.slice(2));
  assertAttemptRoot(parsed.attemptRoot);
  const attemptRoot = realpathSync(parsed.attemptRoot);
  const command = requireRegularExecutable(parsed.command, 'build command');
  const programs = [...new Set([...parsed.allowedPrograms, command, process.execPath])].map((program) =>
    requireRegularExecutable(program, 'allowed program'),
  );
  const ruleGroup = `GPTVoice-LocalWhisper-${process.pid}-${Date.now()}`;
  runWithRequiredCleanup(
    () => {
      addFirewallRules(ruleGroup, programs);
      requireDeniedProbe(attemptRoot);
      runBuild(command, parsed.commandArguments, attemptRoot);
    },
    () => removeFirewallRules(ruleGroup),
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Windows network-denied native build failed'}\n`);
  process.exitCode = 1;
}
