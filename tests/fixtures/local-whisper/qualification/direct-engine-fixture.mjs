import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { setTimeout } from 'node:timers';

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const command = JSON.parse(Buffer.concat(chunks).toString('utf8'));
const model = readFileSync(3);
const wav = readFileSync(4);
if (
  createHash('sha256').update(model).digest('hex') !== command.modelSha256 ||
  createHash('sha256').update(wav).digest('hex') !== command.wavSha256
) {
  process.exitCode = 20;
} else {
  setTimeout(() => process.stdout.write('bounded qualification transcript'), 500);
}
