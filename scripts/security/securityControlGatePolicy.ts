export const BLOCKING_SECURITY_CONTROLS = Object.freeze([
  'application-scan',
  'attestation',
  'builder-image',
  'codeql',
  'dependency',
  'provenance',
  'sbom',
  'secret',
  'workflow',
] as const);

export type BlockingSecurityControl = (typeof BLOCKING_SECURITY_CONTROLS)[number];
export type SecurityControlResult = 'affected' | 'clean' | 'malformed' | 'unavailable';
export type SecurityControlBoundary = 'freeze' | 'merge' | 'qualification' | 'release-candidate';

function fail(control: BlockingSecurityControl): never {
  throw new Error(`SECURITY_CONTROL_GATE_${control.toUpperCase().replace(/-/gu, '_')}_FAILED`);
}

/** Fails closed for every blocking security control at every release decision boundary. */
export class SecurityControlGatePolicy {
  public verify(input: {
    readonly boundary: SecurityControlBoundary;
    readonly controls: Readonly<Record<BlockingSecurityControl, SecurityControlResult>>;
    readonly scorecard: SecurityControlResult;
  }): 'scorecard-advisory' | 'scorecard-clean' {
    if (!['freeze', 'merge', 'qualification', 'release-candidate'].includes(input.boundary)) {
      throw new Error('SECURITY_CONTROL_GATE_BOUNDARY_INVALID');
    }
    for (const control of BLOCKING_SECURITY_CONTROLS) {
      if (input.controls[control] !== 'clean') fail(control);
    }
    if (
      input.scorecard !== 'clean' &&
      input.scorecard !== 'affected' &&
      input.scorecard !== 'malformed' &&
      input.scorecard !== 'unavailable'
    ) {
      throw new Error('SECURITY_CONTROL_GATE_SCORECARD_INVALID');
    }
    return input.scorecard === 'clean' ? 'scorecard-clean' : 'scorecard-advisory';
  }
}
