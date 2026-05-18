import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await readFile(path.join(rootDir, 'package.json'), 'utf-8'));
const generatedDir = path.join(rootDir, 'build', 'generated');
const commonOutputDir = path.join(generatedDir, 'common');
const linuxOutputDir = path.join(generatedDir, 'linux');
const windowsOutputDir = path.join(generatedDir, 'windows');
const macosOutputDir = path.join(generatedDir, 'macos');

function optionValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid package metadata release date: ${value}`);
  }
  return date.toISOString().slice(0, 10);
}

function repositoryUrl() {
  const raw = typeof packageJson.repository === 'string' ? packageJson.repository : packageJson.repository?.url;
  return (raw || packageJson.homepage || '').replace(/^git\+/, '').replace(/\.git$/, '');
}

function authorName() {
  if (typeof packageJson.author === 'string') {
    return packageJson.author;
  }
  return packageJson.author?.name || packageJson.build?.linux?.vendor || packageJson.build?.productName;
}

function appstreamProjectLicense() {
  const license = packageJson.license || 'LicenseRef-Proprietary';
  return license.startsWith('PolyForm-') ? `LicenseRef-${license}` : license;
}

function copyrightHolder(releaseYear) {
  const configured = packageJson.build?.copyright;
  if (configured) {
    return configured.replace(/^Copyright\s+\(c\)\s+/i, '');
  }
  return `${releaseYear} ${authorName()}`;
}

function githubRawScreenshotUrl(repoUrl) {
  const match = repoUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)$/);
  if (!match) {
    return null;
  }
  return `https://raw.githubusercontent.com/${match[1]}/${match[2]}/main/assets/readme/app-connected.png`;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function nsisText(value) {
  return value.replace(/\n/g, '\r\n');
}

const releaseDate = formatDate(optionValue('release-date') || process.env.PACKAGE_RELEASE_DATE);
const releaseYear = releaseDate.slice(0, 4);
const appId = packageJson.build?.appId;
const productName = packageJson.build?.productName || packageJson.name;
const executableName = packageJson.build?.linux?.executableName || packageJson.name;
const summary = packageJson.build?.linux?.synopsis || packageJson.description;
const description = packageJson.build?.linux?.description || packageJson.description;
const repoUrl = repositoryUrl();
const screenshotUrl = githubRawScreenshotUrl(repoUrl);
const keywords = unique([...(packageJson.keywords || []), 'GPT', 'OpenAI', 'Whisper']);
const licenseUrl =
  packageJson.license === 'PolyForm-Noncommercial-1.0.0'
    ? 'https://polyformproject.org/licenses/noncommercial/1.0.0/'
    : repoUrl;

if (!appId) {
  throw new Error('build.appId is required to generate package metadata');
}

const developerId = appId.split('.').slice(0, -1).join('.');
const upstreamLicenseText = await readFile(path.join(rootDir, 'LICENSE'), 'utf-8');

await Promise.all([
  mkdir(commonOutputDir, { recursive: true }),
  mkdir(linuxOutputDir, { recursive: true }),
  mkdir(windowsOutputDir, { recursive: true }),
  mkdir(macosOutputDir, { recursive: true }),
]);

const generatedLicenseText = `${productName}
Version: ${packageJson.version}
Release date: ${releaseDate}
Homepage: ${packageJson.homepage || repoUrl}
License: ${packageJson.license}

${upstreamLicenseText.trim()}
`;

const metainfo = `<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
  <id>${xmlEscape(appId)}</id>
  <metadata_license>CC0-1.0</metadata_license>
  <project_license>${xmlEscape(appstreamProjectLicense())}</project_license>

  <name>${xmlEscape(productName)}</name>
  <summary>${xmlEscape(summary)}</summary>
  <developer id="${xmlEscape(developerId)}">
    <name>${xmlEscape(authorName())}</name>
  </developer>

  <description>
    <p>${xmlEscape(description)}</p>
    <p>It is built as a compact desktop utility with global hotkeys, clipboard-first output, provider-specific settings, and optional translation.</p>
  </description>

  <launchable type="desktop-id">${xmlEscape(executableName)}.desktop</launchable>
  <icon type="stock">${xmlEscape(executableName)}</icon>
  <provides>
    <binary>${xmlEscape(executableName)}</binary>
  </provides>

  <categories>
    <category>${xmlEscape(packageJson.build?.linux?.category || 'Utility')}</category>
  </categories>

  <keywords>
${keywords.map((keyword) => `    <keyword>${xmlEscape(keyword)}</keyword>`).join('\n')}
  </keywords>

  <url type="homepage">${xmlEscape(packageJson.homepage || repoUrl)}</url>
  <url type="bugtracker">${xmlEscape(packageJson.bugs?.url || `${repoUrl}/issues`)}</url>
  <url type="vcs-browser">${xmlEscape(repoUrl)}</url>
${
  screenshotUrl
    ? `
  <screenshots>
    <screenshot type="default">
      <caption>Main ${xmlEscape(productName)} window with provider controls and recording hotkeys</caption>
      <image>${xmlEscape(screenshotUrl)}</image>
    </screenshot>
  </screenshots>
`
    : ''
}
  <content_rating type="oars-1.1" />

  <releases>
    <release version="${xmlEscape(packageJson.version)}" date="${xmlEscape(releaseDate)}">
      <description>
        <p>Packaged release of ${xmlEscape(productName)} ${xmlEscape(packageJson.version)}.</p>
      </description>
    </release>
  </releases>
</component>
`;

const debianCopyright = `Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/
Upstream-Name: ${productName}
Source: ${repoUrl}

Files: *
Copyright: ${copyrightHolder(releaseYear)}
License: ${packageJson.license}
 ${productName} is licensed under the ${packageJson.license} license.
 .
 The full license text is available at ${licenseUrl}.
`;

const privacyManifest = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyCollectedDataTypes</key>
  <array/>
  <key>NSPrivacyTracking</key>
  <false/>
  <key>NSPrivacyAccessedAPITypes</key>
  <array/>
</dict>
</plist>
`;

await Promise.all([
  writeFile(path.join(commonOutputDir, 'license.txt'), generatedLicenseText, 'utf-8'),
  writeFile(path.join(windowsOutputDir, 'license.txt'), nsisText(generatedLicenseText), 'utf-8'),
  writeFile(path.join(linuxOutputDir, `${appId}.metainfo.xml`), metainfo, 'utf-8'),
  writeFile(path.join(linuxOutputDir, 'debian-copyright'), debianCopyright, 'utf-8'),
  writeFile(path.join(macosOutputDir, 'PrivacyInfo.xcprivacy'), privacyManifest, 'utf-8'),
]);

console.log(`Generated package metadata in ${path.relative(rootDir, generatedDir)}`);
console.log(`Package metadata release: version ${packageJson.version}, date ${releaseDate}`);
