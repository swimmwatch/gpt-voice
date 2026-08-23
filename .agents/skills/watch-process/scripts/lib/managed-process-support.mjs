import { freezeRecord } from './runtime-core-support.mjs';

export const DEFAULT_TERMINATION_GRACE_MILLISECONDS = 5_000;

export function isOwnedChildProcess(child) {
  return child !== null && typeof child === 'object' && typeof child.once === 'function';
}

export function validProcessId(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function safeChildKill(child, signal) {
  if (typeof child.kill !== 'function') return false;
  try {
    return child.kill(signal) !== false;
  } catch {
    return false;
  }
}

/**
 * The default cleanup uses the detached POSIX process group created by this
 * runtime. Windows requests direct-child termination only, so the result never
 * claims to have proved a complete process tree.
 */
export function terminateOwnedProcessTree({ child, platform, signal, signalProcess }) {
  if (!isOwnedChildProcess(child) || !validProcessId(child.pid)) {
    return freezeRecord({
      attempted: false,
      directChildRequested: false,
      strategy: 'unavailable',
      treeVerified: false,
    });
  }
  if (platform !== 'win32') {
    try {
      signalProcess(-child.pid, signal);
      return freezeRecord({
        attempted: true,
        directChildRequested: true,
        strategy: 'process-group',
        treeVerified: false,
      });
    } catch {
      const directChildRequested = safeChildKill(child, signal);
      return freezeRecord({
        attempted: directChildRequested,
        directChildRequested,
        strategy: 'direct-child',
        treeVerified: false,
      });
    }
  }
  const directChildRequested = safeChildKill(child, signal);
  return freezeRecord({
    attempted: directChildRequested,
    directChildRequested,
    strategy: 'direct-child',
    treeVerified: false,
  });
}
