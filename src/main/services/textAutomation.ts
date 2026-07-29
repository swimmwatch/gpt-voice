export type TextAutomationAction = 'copy' | 'paste';
export type TextAutomationStrategy = 'linux-x11' | 'linux-wayland' | 'macos' | 'windows';

export interface TextAutomationCommand {
  strategy: TextAutomationStrategy;
  command: string;
  args: string[];
  requiredExecutable: string;
}

export type CommandRunner = (command: string, args: string[]) => Promise<void>;

export interface TextAutomationServiceDependencies {
  readonly environment: NodeJS.ProcessEnv;
  readonly platform: NodeJS.Platform;
  readonly runner: CommandRunner;
}

export function getLinuxTextAutomationStrategy(env: NodeJS.ProcessEnv): 'linux-x11' | 'linux-wayland' {
  const sessionType = (env.XDG_SESSION_TYPE || '').toLowerCase();
  if (sessionType === 'wayland' || env.WAYLAND_DISPLAY) {
    return 'linux-wayland';
  }
  return 'linux-x11';
}

export function buildTextAutomationCommand(
  action: TextAutomationAction,
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
): TextAutomationCommand | null {
  const key = action === 'copy' ? 'c' : 'v';

  if (platform === 'linux') {
    const strategy = getLinuxTextAutomationStrategy(env);
    if (strategy === 'linux-wayland') {
      return {
        strategy,
        command: 'wtype',
        args: ['-M', 'ctrl', key, '-m', 'ctrl'],
        requiredExecutable: 'wtype',
      };
    }
    return {
      strategy,
      command: 'xdotool',
      args: ['key', '--clearmodifiers', `ctrl+${key}`],
      requiredExecutable: 'xdotool',
    };
  }

  if (platform === 'darwin') {
    return {
      strategy: 'macos',
      command: 'osascript',
      args: ['-e', `tell application "System Events" to keystroke "${key}" using command down`],
      requiredExecutable: 'osascript',
    };
  }

  if (platform === 'win32') {
    return {
      strategy: 'windows',
      command: 'powershell.exe',
      args: [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("^${key}")`,
      ],
      requiredExecutable: 'powershell.exe',
    };
  }

  return null;
}

/** Owns one graph's selected-text OS automation boundary. */
export class TextAutomationService {
  public constructor(private readonly dependencies: TextAutomationServiceDependencies) {}

  public async run(action: TextAutomationAction): Promise<TextAutomationCommand> {
    const command = buildTextAutomationCommand(action, this.dependencies.platform, this.dependencies.environment);

    if (!command) {
      throw new Error(`Selected-text ${action} automation is not supported on ${this.dependencies.platform}`);
    }

    if (!(await this.commandExists(command.requiredExecutable))) {
      throw new Error(`${command.requiredExecutable} is required for selected-text automation`);
    }

    await this.dependencies.runner(command.command, command.args);
    return command;
  }

  private async commandExists(command: string): Promise<boolean> {
    try {
      if (this.dependencies.platform === 'win32') {
        await this.dependencies.runner('where.exe', [command]);
      } else {
        await this.dependencies.runner('sh', ['-c', `command -v ${command} >/dev/null 2>&1`]);
      }
      return true;
    } catch {
      return false;
    }
  }
}
