import type { ManagedFilesystemGuardTransport } from './NativeManagedFilesystemGuardTransport';
import { NativeManagedFilesystemAdapter } from './NativeManagedFilesystemAdapter';

/** Linux x64 adapter backed by openat2/openat/fstat held-descriptor operations. */
export class LinuxManagedFilesystemAdapter extends NativeManagedFilesystemAdapter {
  public constructor(transport: ManagedFilesystemGuardTransport) {
    super(transport, 'linux');
  }
}
