import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export type TextAutomationAction = 'copy';
export type TextAutomationStrategy = 'linux-x11' | 'linux-wayland' | 'macos' | 'windows';

export interface TextAutomationCommand {
  strategy: TextAutomationStrategy;
  command: string;
  args: string[];
  requiredExecutable: string;
}

export type CommandRunner = (command: string, args: string[]) => Promise<void>;

const execFileAsync = promisify(execFile);

export function getLinuxTextAutomationStrategy(env: NodeJS.ProcessEnv = process.env): 'linux-x11' | 'linux-wayland' {
  const sessionType = (env.XDG_SESSION_TYPE || '').toLowerCase();
  if (sessionType === 'wayland' || env.WAYLAND_DISPLAY) {
    return 'linux-wayland';
  }
  return 'linux-x11';
}

export function buildTextAutomationCommand(
  _action: TextAutomationAction,
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): TextAutomationCommand | null {
  if (platform === 'linux') {
    const strategy = getLinuxTextAutomationStrategy(env);
    if (strategy === 'linux-wayland') {
      return {
        strategy,
        command: 'wtype',
        args: ['-M', 'ctrl', 'c', '-m', 'ctrl'],
        requiredExecutable: 'wtype',
      };
    }
    return {
      strategy,
      command: 'xdotool',
      args: ['key', '--clearmodifiers', 'ctrl+c'],
      requiredExecutable: 'xdotool',
    };
  }

  if (platform === 'darwin') {
    return {
      strategy: 'macos',
      command: 'osascript',
      args: ['-e', 'tell application "System Events" to keystroke "c" using command down'],
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
        'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("^c")',
      ],
      requiredExecutable: 'powershell.exe',
    };
  }

  return null;
}

export async function commandExists(
  command: string,
  platform: NodeJS.Platform = process.platform,
  runner: CommandRunner = runCommand,
): Promise<boolean> {
  try {
    if (platform === 'win32') {
      await runner('where.exe', [command]);
    } else {
      await runner('sh', ['-c', `command -v ${command} >/dev/null 2>&1`]);
    }
    return true;
  } catch {
    return false;
  }
}

export async function runCommand(command: string, args: string[]): Promise<void> {
  await execFileAsync(command, args, { windowsHide: true });
}

export async function runTextAutomationAction(
  action: TextAutomationAction,
  options: {
    env?: NodeJS.ProcessEnv;
    platform?: NodeJS.Platform;
    runner?: CommandRunner;
  } = {},
): Promise<TextAutomationCommand> {
  const platform = options.platform ?? process.platform;
  const runner = options.runner ?? runCommand;
  const command = buildTextAutomationCommand(action, platform, options.env ?? process.env);

  if (!command) {
    throw new Error(`Selection copy automation is not supported on ${platform}`);
  }

  if (!(await commandExists(command.requiredExecutable, platform, runner))) {
    throw new Error(`${command.requiredExecutable} is required for selected-text translation`);
  }

  await runner(command.command, command.args);
  return command;
}
