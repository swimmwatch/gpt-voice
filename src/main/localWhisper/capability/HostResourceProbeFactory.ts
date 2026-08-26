import type { execFile } from 'node:child_process';

import { FallbackHostMemoryAvailability } from './FallbackHostMemoryAvailability';
import { HostResourcePlatform, resolveHostResourcePlatform } from './HostResourceAvailability';
import { HostMemoryAvailability } from './HostMemoryAvailability';
import { LinuxCommandExecutor } from './LinuxCommandExecutor';
import { LinuxHostMemoryAvailability } from './LinuxHostMemoryAvailability';
import { NvidiaSmiExecutableResolver, NvidiaSmiHostInventory } from './NvidiaSmiHostInventory';
import { NvidiaSmiVramAvailability } from './NvidiaSmiVramAvailability';
import { PlatformCommandExecutor } from './PlatformCommandExecutor';
import { UnsupportedPlatformCommandExecutor } from './UnsupportedPlatformCommandExecutor';
import { WindowsCommandExecutor } from './WindowsCommandExecutor';
import { WindowsHostMemoryAvailability } from './WindowsHostMemoryAvailability';

export interface HostResourceProbeFactoryDependencies {
  readonly platform: NodeJS.Platform;
  readonly environment: Readonly<NodeJS.ProcessEnv>;
  readonly pathExists: (filePath: string) => boolean;
  readonly readFile: (filePath: string, encoding: BufferEncoding) => string;
  readonly fallbackMemoryBytes: () => number;
  readonly execFile: typeof execFile;
}

export interface HostResourceProbes {
  readonly memory: HostMemoryAvailability;
  readonly vram: NvidiaSmiVramAvailability;
  readonly nvidiaInventory: NvidiaSmiHostInventory;
}

/** Creates the process-owned resource readers for the current host platform. */
export class HostResourceProbeFactory {
  private readonly platform: HostResourcePlatform;
  private readonly command: PlatformCommandExecutor;

  public constructor(private readonly dependencies: HostResourceProbeFactoryDependencies) {
    this.platform = resolveHostResourcePlatform(dependencies.platform);
    this.command = this.createCommandExecutor();
  }

  public create(): HostResourceProbes {
    const resolverDependencies = {
      platform: this.dependencies.platform,
      environment: this.dependencies.environment,
      pathExists: this.dependencies.pathExists,
    } as const;
    const executable = new NvidiaSmiExecutableResolver(resolverDependencies);
    return Object.freeze({
      memory: this.createMemoryAvailability(),
      vram: new NvidiaSmiVramAvailability(this.command, executable),
      nvidiaInventory: new NvidiaSmiHostInventory({
        ...resolverDependencies,
        command: this.command,
      }),
    });
  }

  private createMemoryAvailability(): HostMemoryAvailability {
    switch (this.platform) {
      case HostResourcePlatform.Linux:
        return new LinuxHostMemoryAvailability({
          readFile: this.dependencies.readFile,
          fallbackMemoryBytes: this.dependencies.fallbackMemoryBytes,
        });
      case HostResourcePlatform.Windows:
        return new WindowsHostMemoryAvailability({
          fallbackMemoryBytes: this.dependencies.fallbackMemoryBytes,
        });
      case HostResourcePlatform.Other:
        return new FallbackHostMemoryAvailability({
          fallbackMemoryBytes: this.dependencies.fallbackMemoryBytes,
        });
    }
  }

  private createCommandExecutor(): PlatformCommandExecutor {
    const dependencies = { execFile: this.dependencies.execFile } as const;
    switch (this.platform) {
      case HostResourcePlatform.Windows:
        return new WindowsCommandExecutor(dependencies);
      case HostResourcePlatform.Linux:
        return new LinuxCommandExecutor(dependencies);
      case HostResourcePlatform.Other:
        return new UnsupportedPlatformCommandExecutor(dependencies);
    }
  }
}
