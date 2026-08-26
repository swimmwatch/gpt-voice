import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

interface NpmCommand {
  readonly arguments?: readonly string[];
  readonly script: string;
}

const MAXIMUM_FAILURE_OUTPUT_CHARACTERS = 65_536;

function appendBoundedOutput(current: string, chunk: string): string {
  const combined = current + chunk;
  return combined.length <= MAXIMUM_FAILURE_OUTPUT_CHARACTERS
    ? combined
    : combined.slice(combined.length - MAXIMUM_FAILURE_OUTPUT_CHARACTERS);
}

class NpmCommandRunner {
  public constructor(
    private readonly workspaceRoot: string,
    private readonly npmCliPath: string,
  ) {}

  public run(command: NpmCommand): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const arguments_ = [
        this.npmCliPath,
        'run',
        command.script,
        ...(command.arguments ? ['--', ...command.arguments] : []),
      ];
      const child = spawn(process.execPath, arguments_, {
        cwd: this.workspaceRoot,
        env: process.env,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      let output = '';
      let settled = false;
      const capture = (chunk: Buffer): void => {
        output = appendBoundedOutput(output, chunk.toString('utf8'));
      };
      child.stdout.on('data', capture);
      child.stderr.on('data', capture);
      child.once('error', (error) => {
        if (settled) return;
        settled = true;
        reject(new Error(`${command.script} could not start: ${error.message}`));
      });
      child.once('close', (code, signal) => {
        if (settled) return;
        settled = true;
        if (code === 0) {
          process.stdout.write(`[windows-readiness] PASS ${command.script}\n`);
          resolve();
          return;
        }
        const status = signal ? `signal ${signal}` : `exit ${code ?? 'unknown'}`;
        reject(new Error(`${command.script} failed (${status})${output.trim() ? `\n${output.trim()}` : ''}`));
      });
    });
  }
}

class WindowsReadinessVerifier {
  public constructor(private readonly commandRunner: NpmCommandRunner) {}

  public async verify(): Promise<void> {
    if (process.platform !== 'win32' || process.arch !== 'x64') {
      throw new Error('Packet 20 Windows readiness verification requires native Windows x64');
    }

    await this.runStage('contracts', [
      { script: 'test:local-whisper:windows-readiness' },
      { script: 'test:local-whisper:filesystem' },
      { script: 'test:local-whisper:supervisor' },
      { script: 'test:local-whisper:composition' },
      {
        script: 'verify:local-whisper:native-toolchain',
        arguments: ['--profile=windows-x64-cpu-msvc-19.51-v1', '--contract-only'],
      },
      {
        script: 'verify:local-whisper:native-toolchain',
        arguments: ['--profile=windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1', '--contract-only'],
      },
      { script: 'typecheck' },
      { script: 'test:types' },
      { script: 'lint' },
      { script: 'format:check' },
    ]);
    await this.runStage('native-quality', [
      { script: 'test:local-whisper:fs-guard:native' },
      { script: 'test:local-whisper:launcher:native' },
    ]);
    await this.runStage('release-helpers', [
      { script: 'build:local-whisper:fs-guard' },
      { script: 'build:local-whisper:launcher' },
    ]);
    await this.runStage('runtime-pack-cpu', [{ script: 'produce:local-whisper:windows-runtime-pack:cpu' }]);
    await this.runStage('runtime-cuda-build', [
      {
        script: 'build:local-whisper:whisper-cpp-cuda',
        arguments: ['--profile=windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1'],
      },
    ]);
    await this.runStage('runtime-cuda-verification', [
      {
        script: 'verify:local-whisper:whisper-cpp-cuda',
        arguments: ['--profile=windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1'],
      },
    ]);
    await this.runStage('runtime-pack-cuda', [{ script: 'produce:local-whisper:windows-runtime-pack:cuda' }]);
    await this.runStage('runtime-integration-cpu', [{ script: 'test:local-whisper:whisper-cpp-cpu-integration' }]);
    await this.runStage('runtime-integration-cuda', [{ script: 'test:local-whisper:whisper-cpp-cuda-integration' }]);
    await this.runStage('runtime-pack-audit', [{ script: 'audit:local-whisper:whisper-cpp-pack' }]);
    await this.runStage('application-smoke', [{ script: 'test:local-whisper:windows-application-smoke' }]);
    await this.runStage('production-build', [{ script: 'build:prod' }]);
    await this.runStage('unpacked-package-build', [{ script: 'dist:win', arguments: ['--dir'] }]);
    await this.runStage('unpacked-package-verification', [
      { script: 'verify:packaged' },
      { script: 'verify:local-whisper:packaging:windows-unpacked' },
    ]);
  }

  private async runStage(name: string, commands: readonly NpmCommand[]): Promise<void> {
    const execution = commands.length === 1 ? '1 command' : `${commands.length} parallel`;
    process.stdout.write(`[windows-readiness] START ${name} (${execution})\n`);
    const results = await Promise.allSettled(commands.map((command) => this.commandRunner.run(command)));
    const failures: Error[] = [];
    for (const result of results) {
      if (result.status !== 'rejected') continue;
      failures.push(result.reason instanceof Error ? result.reason : new Error(String(result.reason)));
    }
    if (failures.length > 0) {
      throw new Error(
        [`Packet 20 Windows readiness stage failed: ${name}`, ...failures.map((failure) => failure.message)].join('\n'),
      );
    }
    process.stdout.write(`[windows-readiness] PASS ${name}\n`);
  }
}

async function main(): Promise<void> {
  const npmCliPath = process.env.npm_execpath;
  if (!npmCliPath || !path.isAbsolute(npmCliPath)) {
    throw new Error('Packet 20 Windows readiness verification requires npm_execpath');
  }
  const workspaceRoot = path.resolve(__dirname, '..', '..');
  await new WindowsReadinessVerifier(new NpmCommandRunner(workspaceRoot, npmCliPath)).verify();
  process.stdout.write('Packet 20 Windows runtime delivery readiness verified\n');
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
