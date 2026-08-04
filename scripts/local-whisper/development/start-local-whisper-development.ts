import * as path from 'node:path';

import { createLocalWhisperDevelopmentSession } from './LocalWhisperDevelopmentSession';

async function main(): Promise<void> {
  if (process.argv.slice(2).some((argument) => argument !== '--platform=linux')) {
    throw new Error('Usage: npm run start:local-whisper:development -- --platform=linux');
  }
  process.stdout.write('Starting the ordinary app with temporary Local Whisper development qualification artifacts.\n');
  await createLocalWhisperDevelopmentSession().run(path.resolve(__dirname, '..', '..', '..'));
  process.stdout.write('Local Whisper development session stopped; ephemeral trust and server state were removed.\n');
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Local Whisper development session failed'}\n`);
  process.exitCode = 1;
});
