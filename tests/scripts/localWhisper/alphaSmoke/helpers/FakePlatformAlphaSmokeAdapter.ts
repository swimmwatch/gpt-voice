import type { PlatformAlphaSmokeAdapter } from '@scripts/local-whisper/alpha-smoke/PlatformAlphaSmokeAdapter';

/** Exposes deterministic exercise and cleanup outcomes without launching the application. */
export class FakePlatformAlphaSmokeAdapter implements PlatformAlphaSmokeAdapter {
  public readonly platform = 'linux' as const;
  public failAt: 'cpu' | 'cuda' | 'finalize' | 'offline' | 'package' | 'preflight' | null = null;
  public finalizeCalls = 0;

  public async preflight(): Promise<{ packageDisposition: 'exact-alpha'; settingsBackupStatus: 'retained-private' }> {
    if (this.failAt === 'preflight') throw new Error('preflight failed');
    return Object.freeze({ packageDisposition: 'exact-alpha', settingsBackupStatus: 'retained-private' });
  }

  public async ensurePackageReady(): Promise<void> {
    if (this.failAt === 'package') throw new Error('package failed');
  }

  public async revalidateBeforeAttempt(): Promise<void> {
    if (this.failAt === 'package') throw new Error('package drift');
  }

  public async exerciseCpu(): Promise<{ backend: 'cpu'; outcome: 'verified' }> {
    if (this.failAt === 'cpu') throw new Error('cpu failed');
    return Object.freeze({ backend: 'cpu', outcome: 'verified' });
  }

  public async exerciseCuda(): Promise<{ backend: 'cuda'; outcome: 'verified' }> {
    if (this.failAt === 'cuda') throw new Error('cuda failed');
    return Object.freeze({ backend: 'cuda', outcome: 'verified' });
  }

  public async exerciseOfflineCuda(): Promise<{ backend: 'offline-cuda'; outcome: 'verified' }> {
    if (this.failAt === 'offline') throw new Error('offline failed');
    return Object.freeze({ backend: 'offline-cuda', outcome: 'verified' });
  }

  public async finalize(): Promise<{ packageStatus: 'retained-alpha'; settingsBackupStatus: 'retained-private' }> {
    this.finalizeCalls += 1;
    if (this.failAt === 'finalize') throw new Error('finalize failed');
    return Object.freeze({ packageStatus: 'retained-alpha', settingsBackupStatus: 'retained-private' });
  }

  public async observeCompletion(): Promise<{ packageStatus: 'unverified'; settingsBackupStatus: 'integrity-failed' }> {
    return Object.freeze({ packageStatus: 'unverified', settingsBackupStatus: 'integrity-failed' });
  }
}
