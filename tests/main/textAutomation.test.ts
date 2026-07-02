import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTextAutomationCommand,
  getLinuxTextAutomationStrategy,
  runTextAutomationAction,
} from '@main/services/textAutomation';

describe('textAutomation', () => {
  it('selects Linux Wayland automation when Wayland is active', () => {
    assert.equal(getLinuxTextAutomationStrategy({ XDG_SESSION_TYPE: 'wayland' }), 'linux-wayland');
    assert.equal(getLinuxTextAutomationStrategy({ WAYLAND_DISPLAY: 'wayland-0' }), 'linux-wayland');
  });

  it('selects Linux X11 automation by default', () => {
    assert.equal(getLinuxTextAutomationStrategy({ XDG_SESSION_TYPE: 'x11' }), 'linux-x11');
    assert.equal(getLinuxTextAutomationStrategy({}), 'linux-x11');
  });

  it('builds Linux X11 xdotool commands', () => {
    assert.deepEqual(buildTextAutomationCommand('copy', 'linux', { XDG_SESSION_TYPE: 'x11' }), {
      strategy: 'linux-x11',
      command: 'xdotool',
      args: ['key', '--clearmodifiers', 'ctrl+c'],
      requiredExecutable: 'xdotool',
    });
  });

  it('builds Linux Wayland wtype commands', () => {
    assert.deepEqual(buildTextAutomationCommand('copy', 'linux', { XDG_SESSION_TYPE: 'wayland' }), {
      strategy: 'linux-wayland',
      command: 'wtype',
      args: ['-M', 'ctrl', 'c', '-m', 'ctrl'],
      requiredExecutable: 'wtype',
    });
  });

  it('builds macOS osascript commands', () => {
    assert.deepEqual(buildTextAutomationCommand('copy', 'darwin')?.args, [
      '-e',
      'tell application "System Events" to keystroke "c" using command down',
    ]);
  });

  it('builds Windows SendKeys commands', () => {
    const copyCommand = buildTextAutomationCommand('copy', 'win32');

    assert.equal(copyCommand?.command, 'powershell.exe');
    assert.equal(
      copyCommand?.args.includes(
        'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("^c")',
      ),
      true,
    );
  });

  it('checks executable availability before running automation', async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    await runTextAutomationAction('copy', {
      platform: 'linux',
      env: { XDG_SESSION_TYPE: 'x11' },
      runner: async (command, args) => {
        calls.push({ command, args });
      },
    });

    assert.deepEqual(calls, [
      { command: 'sh', args: ['-c', 'command -v xdotool >/dev/null 2>&1'] },
      { command: 'xdotool', args: ['key', '--clearmodifiers', 'ctrl+c'] },
    ]);
  });
});
