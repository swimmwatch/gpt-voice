import { readFileSync } from 'node:fs';
import type { AlphaSmokeClock } from './AlphaSmokeSession';

export interface AlphaSmokeDeadline {
  readonly bootId: string;
  readonly expiresAtUptimeMilliseconds: number;
}

const BOOT_ID_PATTERN = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/u;

export function isLinuxAlphaSmokeDeadline(value: unknown): value is AlphaSmokeDeadline {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const deadline = value as Record<string, unknown>;
  return (
    Object.keys(deadline).sort().join(',') === 'bootId,expiresAtUptimeMilliseconds' &&
    typeof deadline.bootId === 'string' &&
    BOOT_ID_PATTERN.test(deadline.bootId) &&
    typeof deadline.expiresAtUptimeMilliseconds === 'number' &&
    Number.isSafeInteger(deadline.expiresAtUptimeMilliseconds) &&
    deadline.expiresAtUptimeMilliseconds > 0
  );
}

/** Wall time is diagnostic only; persisted uptime deadlines cannot be reset by restarting the CLI. */
export class LinuxAlphaSmokeClock implements AlphaSmokeClock {
  public constructor(private readonly read: (file: string) => string = (file) => readFileSync(file, 'utf8')) {}

  public now(): number {
    return Date.now();
  }

  public capture(durationMilliseconds: number): AlphaSmokeDeadline {
    if (!Number.isSafeInteger(durationMilliseconds) || durationMilliseconds <= 0)
      throw new Error('ALPHA_SMOKE_CLOCK_INVALID');
    return Object.freeze({ bootId: this.bootId(), expiresAtUptimeMilliseconds: this.uptime() + durationMilliseconds });
  }

  public remaining(deadline: AlphaSmokeDeadline): number {
    if (deadline.bootId !== this.bootId()) throw new Error('ALPHA_SMOKE_CLOCK_BOOT_CHANGED');
    return Math.max(0, deadline.expiresAtUptimeMilliseconds - this.uptime());
  }

  public assertWithinDeadline(deadline: AlphaSmokeDeadline): void {
    if (this.remaining(deadline) <= 0) throw new Error('ALPHA_SMOKE_DEADLINE_EXHAUSTED');
  }

  private bootId(): string {
    const identity = this.read('/proc/sys/kernel/random/boot_id').trim();
    if (!BOOT_ID_PATTERN.test(identity)) throw new Error('ALPHA_SMOKE_CLOCK_INVALID');
    return identity;
  }

  private uptime(): number {
    const document = this.read('/proc/uptime').trim();
    const fields = document.split(/\s+/u);
    if (fields.length !== 2 || fields.some((field) => !/^\d+$/u.test(field) && !/^\d+\.\d+$/u.test(field)))
      throw new Error('ALPHA_SMOKE_CLOCK_INVALID');
    const milliseconds = Math.floor(Number(document.split(/\s+/u)[0]) * 1000);
    if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) throw new Error('ALPHA_SMOKE_CLOCK_INVALID');
    return milliseconds;
  }
}
