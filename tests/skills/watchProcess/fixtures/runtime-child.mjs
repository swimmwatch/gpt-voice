import * as path from 'node:path';
import process from 'node:process';
import { setInterval } from 'node:timers';

const [mode, ...arguments_] = process.argv.slice(2);

if (mode === 'verify-contract') {
  const validArguments = arguments_.length === 2 && arguments_[0] === 'first value' && arguments_[1] === 'юникод';
  const validCwd = path.basename(process.cwd()) === 'fixtures';
  const validEnvironment =
    process.env.FIXTURE_ALLOWED === 'allowed' &&
    process.env.FIXTURE_DECLARED === 'declared' &&
    process.env.FIXTURE_BLOCKED === undefined;
  process.stdout.write('fixture-output'.repeat(200));
  process.stderr.write('fixture-error');
  process.exitCode = validArguments && validCwd && validEnvironment ? 0 : 9;
} else if (mode === 'nonzero') {
  process.stderr.write('intentional-nonzero');
  process.exitCode = 7;
} else if (mode === 'wait') {
  setInterval(() => {}, 1_000);
} else {
  process.exitCode = 10;
}
