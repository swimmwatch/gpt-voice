import {
  ManagedFilesystemAdapterError,
  type ManagedFilesystemPlatformAdapter,
} from './ManagedFilesystemPlatformAdapter';

/** Planned-only type skeleton. Every operation fails before creating storage. */
export class MacOSManagedFilesystemAdapter implements ManagedFilesystemPlatformAdapter {
  public getProcessStartIdentity(): Promise<never> {
    return Promise.reject(new ManagedFilesystemAdapterError('UNSUPPORTED'));
  }

  public initialize(): Promise<never> {
    return Promise.reject(new ManagedFilesystemAdapterError('UNSUPPORTED'));
  }

  public acquireArtifactLock(): Promise<never> {
    return Promise.reject(new ManagedFilesystemAdapterError('UNSUPPORTED'));
  }

  public createStagingDirectory(): Promise<never> {
    return Promise.reject(new ManagedFilesystemAdapterError('UNSUPPORTED'));
  }

  public createStagedFile(): Promise<never> {
    return Promise.reject(new ManagedFilesystemAdapterError('UNSUPPORTED'));
  }

  public appendStagedFile(): Promise<never> {
    return Promise.reject(new ManagedFilesystemAdapterError('UNSUPPORTED'));
  }

  public sealStagedFile(): Promise<never> {
    return Promise.reject(new ManagedFilesystemAdapterError('UNSUPPORTED'));
  }

  public inspectDirectory(): Promise<never> {
    return Promise.reject(new ManagedFilesystemAdapterError('UNSUPPORTED'));
  }

  public listArtifactDirectoryNames(): Promise<never> {
    return Promise.reject(new ManagedFilesystemAdapterError('UNSUPPORTED'));
  }

  public openArtifactDirectory(): Promise<never> {
    return Promise.reject(new ManagedFilesystemAdapterError('UNSUPPORTED'));
  }

  public promoteStagingDirectory(): Promise<never> {
    return Promise.reject(new ManagedFilesystemAdapterError('UNSUPPORTED'));
  }

  public quarantineArtifactDirectory(): Promise<never> {
    return Promise.reject(new ManagedFilesystemAdapterError('UNSUPPORTED'));
  }

  public deleteQuarantinedFile(): Promise<never> {
    return Promise.reject(new ManagedFilesystemAdapterError('UNSUPPORTED'));
  }

  public removeEmptyQuarantineDirectory(): Promise<never> {
    return Promise.reject(new ManagedFilesystemAdapterError('UNSUPPORTED'));
  }

  public revalidate(): Promise<never> {
    return Promise.reject(new ManagedFilesystemAdapterError('UNSUPPORTED'));
  }

  public release(): Promise<void> {
    return Promise.resolve();
  }

  public dispose(): Promise<void> {
    return Promise.resolve();
  }
}
