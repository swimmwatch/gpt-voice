import { freezeArray, freezeRecord, isRecord, runtimeFail } from './runtime-core-support.mjs';
import { WATCH_BLOCKERS, WATCH_PHASES, validateOutcome, validatePhase } from './runtime-state-contracts.mjs';

const TRANSITIONS = Object.freeze({
  Armed: Object.freeze(['Preparing', 'Blocked']),
  Preparing: Object.freeze(['Watching', 'Blocked']),
  Watching: Object.freeze(['Watching', 'NeedsAgent', 'Finalizing', 'Blocked', 'Cancelled']),
  NeedsAgent: Object.freeze(['Repairing', 'Blocked']),
  Repairing: Object.freeze(['Verifying', 'Blocked', 'Cancelled']),
  Verifying: Object.freeze(['Restarting', 'Repairing', 'Blocked', 'Cancelled']),
  Restarting: Object.freeze(['Watching', 'Repairing', 'Blocked', 'Cancelled']),
  Finalizing: Object.freeze(['Success', 'Blocked']),
  Blocked: Object.freeze(['Armed']),
  Cancelled: Object.freeze([]),
  Success: Object.freeze([]),
});

const BLOCKER_BY_OUTCOME = Object.freeze({
  authentication_failed: 'authentication-failed',
  delivery_failed: 'delivery-failed',
  dispatch_failed: 'dispatch-failed',
  integrity_failed: 'integrity-failed',
  monitoring_failed: 'atomicity-uncertain',
  scenario_changed: 'scenario-changed',
  target_lost: 'target-lost',
  timed_out: 'atomicity-uncertain',
  verification_failed: 'verification-failed',
  watcher_lost: 'watcher-lost',
});

const NEEDS_AGENT_OUTCOMES = new Set([
  'authentication_failed',
  'delivery_failed',
  'dispatch_failed',
  'monitoring_failed',
  'target_failed',
  'target_lost',
  'timed_out',
  'verification_failed',
  'watcher_lost',
]);

function assertClosedRecord(value, fields, code) {
  if (!isRecord(value)) runtimeFail(code);
  for (const field of Object.keys(value)) {
    if (!fields.has(field)) runtimeFail(code);
  }
  return value;
}

function validateNullableOutcome(value, code) {
  if (value === null) return null;
  return validateOutcome(value, code);
}

function validateNullableBlocker(value, code) {
  if (value === null) return null;
  if (typeof value !== 'string' || !WATCH_BLOCKERS.includes(value)) runtimeFail(code);
  return value;
}

function requiredOutcomeForPhase(phase, outcome) {
  if (phase === 'Armed') return outcome === null;
  if (phase === 'Watching' || phase === 'Preparing' || phase === 'Finalizing') return outcome === 'running';
  if (phase === 'Success') return outcome === 'succeeded';
  if (phase === 'Cancelled') return outcome === 'user_cancelled' || outcome === 'target_cancelled';
  if (phase === 'Blocked') return outcome !== null;
  return outcome !== null;
}

/**
 * Owns the closed runtime state graph. It validates state movement but never
 * writes state, talks to an adapter, or decides whether a repair is safe.
 */
export class ProcessWatchTransitionTable {
  allowedNextPhases(phase) {
    return freezeArray(TRANSITIONS[validatePhase(phase, 'invalid-transition-phase')] ?? []);
  }

  blockerForOutcome(outcome) {
    const normalized = validateOutcome(outcome, 'invalid-transition-outcome');
    const blocker = BLOCKER_BY_OUTCOME[normalized];
    if (blocker === undefined) runtimeFail('transition-outcome-not-blockable');
    return blocker;
  }

  assert({ blocker = null, fromPhase, outcome = null, toPhase } = {}) {
    assertClosedRecord(
      { blocker, fromPhase, outcome, toPhase },
      new Set(['blocker', 'fromPhase', 'outcome', 'toPhase']),
      'invalid-watch-transition',
    );
    const from = validatePhase(fromPhase, 'invalid-transition-phase');
    const to = validatePhase(toPhase, 'invalid-transition-phase');
    const normalizedOutcome = validateNullableOutcome(outcome, 'invalid-transition-outcome');
    const normalizedBlocker = validateNullableBlocker(blocker, 'invalid-transition-blocker');
    if (!TRANSITIONS[from].includes(to)) runtimeFail('watch-transition-not-allowed');
    if (!requiredOutcomeForPhase(to, normalizedOutcome)) runtimeFail('transition-outcome-phase-mismatch');

    if (to === 'Blocked') {
      if (normalizedBlocker === null || BLOCKER_BY_OUTCOME[normalizedOutcome] !== normalizedBlocker) {
        runtimeFail('transition-blocker-outcome-mismatch');
      }
    } else if (normalizedBlocker !== null) {
      runtimeFail('transition-blocker-phase-mismatch');
    }

    if (to === 'NeedsAgent' && !NEEDS_AGENT_OUTCOMES.has(normalizedOutcome)) {
      runtimeFail('transition-outcome-needs-agent-mismatch');
    }
    if (
      to === 'Repairing' &&
      !['target_failed', 'verification_failed', 'delivery_failed', 'dispatch_failed'].includes(normalizedOutcome)
    ) {
      runtimeFail('transition-outcome-repairing-mismatch');
    }
    if (to === 'Verifying' && !['target_failed', 'verification_failed'].includes(normalizedOutcome)) {
      runtimeFail('transition-outcome-verifying-mismatch');
    }
    if (to === 'Restarting' && normalizedOutcome !== 'target_failed')
      runtimeFail('transition-outcome-restarting-mismatch');

    return freezeRecord({ blocker: normalizedBlocker, fromPhase: from, outcome: normalizedOutcome, toPhase: to });
  }
}

export const WATCH_TRANSITION_PHASES = freezeRecord(
  Object.fromEntries(WATCH_PHASES.map((phase) => [phase, freezeArray(TRANSITIONS[phase])])),
);
