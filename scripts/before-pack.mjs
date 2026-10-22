import { AppImageLauncherHardener } from './security/appimage-launcher-policy.mjs';

export default async function beforePack(context) {
  if (context.electronPlatformName !== 'linux' || !context.targets.some((target) => target.name === 'appImage')) return;
  const hardener = new AppImageLauncherHardener(context.packager.projectDir);
  await hardener.verify();
}
