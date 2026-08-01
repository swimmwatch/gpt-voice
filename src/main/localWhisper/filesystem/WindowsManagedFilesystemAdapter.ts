import type { ManagedFilesystemGuardTransport } from './NativeManagedFilesystemGuardTransport';
import { NativeManagedFilesystemAdapter } from './NativeManagedFilesystemAdapter';

/** Windows x64 adapter backed by reparse-aware held-handle operations in the owned guard. */
export class WindowsManagedFilesystemAdapter extends NativeManagedFilesystemAdapter {
  public constructor(transport: ManagedFilesystemGuardTransport) {
    super(transport, 'win32');
  }
}
