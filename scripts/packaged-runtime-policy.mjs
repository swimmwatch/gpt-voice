const REQUIRED_PATHS = [
  'dist/about.html',
  'dist/history.html',
  'dist/index.html',
  'dist/main.js',
  'dist/preload.js',
  'dist/renderer.js',
  'dist/settings.html',
  'package.json',
];

const LINUX_ICON_SIZES = [16, 24, 32, 48, 64, 128, 256, 512];

export const RUNTIME_ASSET_PATHS = [
  'icon.png',
  ...LINUX_ICON_SIZES.map((size) => `icons/${size}x${size}.png`),
  'tray-icon-idle.png',
  'tray-icon-paused.png',
  'tray-icon-prettifying.png',
  'tray-icon-processing.png',
  'tray-icon-recording.png',
];

export const ELECTRON_LOCALE_FILENAMES = ['en-GB.pak', 'en-US.pak', 'ru.pak', 'uk.pak'];
const ELECTRON_LOCALE_FILE_NAME = /^[a-z]{2,3}(?:-[A-Z]{2,3})?\.pak$/u;

const ALLOWED_RUNTIME_MODULES = new Set([
  '@floating-ui/core',
  '@floating-ui/dom',
  '@floating-ui/react-dom',
  '@floating-ui/utils',
  '@isaacs/fs-minipass',
  '@radix-ui/number',
  '@radix-ui/primitive',
  '@radix-ui/rect',
  '@radix-ui/react-alert-dialog',
  '@radix-ui/react-arrow',
  '@radix-ui/react-collapsible',
  '@radix-ui/react-collection',
  '@radix-ui/react-compose-refs',
  '@radix-ui/react-context',
  '@radix-ui/react-dialog',
  '@radix-ui/react-direction',
  '@radix-ui/react-dismissable-layer',
  '@radix-ui/react-dropdown-menu',
  '@radix-ui/react-focus-guards',
  '@radix-ui/react-focus-scope',
  '@radix-ui/react-id',
  '@radix-ui/react-menu',
  '@radix-ui/react-popper',
  '@radix-ui/react-portal',
  '@radix-ui/react-presence',
  '@radix-ui/react-primitive',
  '@radix-ui/react-roving-focus',
  '@radix-ui/react-scroll-area',
  '@radix-ui/react-select',
  '@radix-ui/react-slider',
  '@radix-ui/react-slot',
  '@radix-ui/react-switch',
  '@radix-ui/react-tabs',
  '@radix-ui/react-tooltip',
  '@radix-ui/react-use-callback-ref',
  '@radix-ui/react-use-controllable-state',
  '@radix-ui/react-use-effect-event',
  '@radix-ui/react-use-is-hydrated',
  '@radix-ui/react-use-layout-effect',
  '@radix-ui/react-use-previous',
  '@radix-ui/react-use-rect',
  '@radix-ui/react-use-size',
  '@radix-ui/react-visually-hidden',
  'agent-base',
  'aria-hidden',
  'chownr',
  'class-variance-authority',
  'cloakbrowser',
  'clsx',
  'debug',
  'detect-node-es',
  'electron-log',
  'filesize',
  'get-nonce',
  'http-status-codes',
  'ip-address',
  'lucide-react',
  'minipass',
  'minizlib',
  'mmdb-lib',
  'ms',
  'playwright-core',
  'react',
  'react-dom',
  'react-remove-scroll',
  'react-remove-scroll-bar',
  'react-style-singleton',
  'scheduler',
  'smart-buffer',
  'socks',
  'socks-proxy-agent',
  'sonner',
  'tailwind-merge',
  'tar',
  'tslib',
  'use-callback-ref',
  'use-sidecar',
  'yallist',
]);

const FORBIDDEN_PATH_SEGMENTS = new Set(['__test__', '__tests__', 'fixture', 'fixtures', 'test', 'tests']);

function normalizePath(filePath) {
  return filePath.replaceAll('\\', '/').replace(/^\/+/, '');
}

function getRuntimeModuleName(filePath) {
  const segments = filePath.split('/');
  if (segments[0] !== 'node_modules' || !segments[1]) {
    return null;
  }

  if (segments[1].startsWith('@')) {
    return segments[2] ? `${segments[1]}/${segments[2]}` : null;
  }

  return segments[1];
}

function isStaleRendererAsset(filePath) {
  return (
    filePath.startsWith('dist/renderer.') && !['dist/renderer.js', 'dist/renderer.js.LICENSE.txt'].includes(filePath)
  );
}

function isDiagnosticOrTestPath(filePath) {
  return (
    filePath.endsWith('.d.cts') ||
    filePath.endsWith('.d.mts') ||
    filePath.endsWith('.d.ts') ||
    filePath.endsWith('.map') ||
    filePath.split('/').some((segment) => FORBIDDEN_PATH_SEGMENTS.has(segment))
  );
}

export function getPackagedRuntimeViolations(filePaths) {
  const normalizedPaths = filePaths.map(normalizePath);
  const violations = [];

  for (const requiredPath of REQUIRED_PATHS) {
    if (!normalizedPaths.includes(requiredPath)) {
      violations.push(`missing required path: ${requiredPath}`);
    }
  }

  for (const filePath of normalizedPaths) {
    if (filePath.startsWith('assets/')) {
      violations.push(`duplicate ASAR asset: ${filePath}`);
      continue;
    }
    if (isDiagnosticOrTestPath(filePath)) {
      violations.push(`forbidden diagnostic or test path: ${filePath}`);
      continue;
    }
    if (isStaleRendererAsset(filePath)) {
      violations.push(`stale renderer asset: ${filePath}`);
      continue;
    }

    const moduleName = getRuntimeModuleName(filePath);
    if (moduleName && !ALLOWED_RUNTIME_MODULES.has(moduleName)) {
      violations.push(`unexpected runtime module: ${moduleName}`);
    }
  }

  return violations.toSorted((left, right) => left.localeCompare(right, 'en'));
}

export function getRuntimeAssetViolations(assetPaths) {
  const normalizedPaths = assetPaths.map(normalizePath);
  const violations = [];

  for (const requiredPath of RUNTIME_ASSET_PATHS) {
    if (!normalizedPaths.includes(requiredPath)) {
      violations.push(`missing runtime asset: ${requiredPath}`);
    }
  }

  for (const assetPath of normalizedPaths) {
    if (!RUNTIME_ASSET_PATHS.includes(assetPath)) {
      violations.push(`unexpected runtime asset: ${assetPath}`);
    }
  }

  return violations.toSorted((left, right) => left.localeCompare(right, 'en'));
}

export function getElectronLocaleViolations(localePaths) {
  const localeFiles = localePaths.filter((localePath) => ELECTRON_LOCALE_FILE_NAME.test(localePath));
  const violations = [];

  for (const requiredLocale of ELECTRON_LOCALE_FILENAMES) {
    if (!localeFiles.includes(requiredLocale)) {
      violations.push(`missing Electron locale: ${requiredLocale}`);
    }
  }

  for (const localeFile of localeFiles) {
    if (!ELECTRON_LOCALE_FILENAMES.includes(localeFile)) {
      violations.push(`unexpected Electron locale: ${localeFile}`);
    }
  }

  return violations.toSorted((left, right) => left.localeCompare(right, 'en'));
}
