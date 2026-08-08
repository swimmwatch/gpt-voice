import * as path from 'node:path';

import { createLocalWhisperDevelopmentSession } from './LocalWhisperDevelopmentSession';
import type { DevelopmentRuntimePlatformSelector } from './DevelopmentRuntimeInputs';

function requestedPlatform(arguments_: readonly string[]): DevelopmentRuntimePlatformSelector {
  if (arguments_.length !== 1 || !arguments_[0]?.startsWith('--platform=')) {
    throw new Error('Usage: npm run start:local-whisper:development -- --platform=current|linux|win32');
  }
  const platform = arguments_[0].slice('--platform='.length);
  if (platform !== 'current' && platform !== 'linux' && platform !== 'win32') {
    throw new Error('Usage: npm run start:local-whisper:development -- --platform=current|linux|win32');
  }
  return platform;
}

async function main(): Promise<void> {
  const platform = requestedPlatform(process.argv.slice(2));
  process.stdout.write('Starting the ordinary app with temporary Local Whisper development qualification artifacts.\n');
  await createLocalWhisperDevelopmentSession().run(path.resolve(__dirname, '..', '..', '..'), platform);
  process.stdout.write('Local Whisper development session stopped; ephemeral trust and server state were removed.\n');
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Local Whisper development session failed'}\n`);
  process.exitCode = 1;
});
