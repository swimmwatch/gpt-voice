import { appendFile } from 'node:fs/promises';
import process from 'node:process';

import { FixtureBundleProducer } from './FixtureBundleProducer';
import { assertOnlyOptions, parseOptions, requiredOption } from './arguments';

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  assertOnlyOptions(options, ['output']);
  const result = await new FixtureBundleProducer().produce(requiredOption(options, 'output'));
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    await appendFile(
      githubOutput,
      `bundle_digest=${result.bundleManifestSha256}\ncatalog_digest=${result.catalogSha256}\nkey_id=${result.keyId}\n`,
      { encoding: 'utf8', mode: 0o600 },
    );
  }
  process.stdout.write(
    `${JSON.stringify({ bundleDigest: result.bundleManifestSha256, catalogDigest: result.catalogSha256, keyId: result.keyId })}\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Local Whisper fixture generation failed'}\n`);
  process.exitCode = 1;
});
