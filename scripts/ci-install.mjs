import { CiInstallCoordinator } from './ci-install-core.mjs';

await new CiInstallCoordinator().install().catch((error) => {
  const message =
    error instanceof Error && /^CI_INSTALL_[A-Z0-9_]+$/u.test(error.message) ? error.message : 'CI_INSTALL_FAILED';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
