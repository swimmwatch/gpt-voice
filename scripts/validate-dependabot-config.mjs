import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import { parseDocument } from 'yaml';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(rootDir, '.github', 'dependabot.yml');
const schemaUrl = 'https://json.schemastore.org/dependabot-2.0.json';

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function formatAjvError(error) {
  const location = error.instancePath || '/';
  return `${location}: ${error.message}`;
}

function findUpdate(config, packageEcosystem, directory = '/') {
  return config.updates?.find(
    (update) => update['package-ecosystem'] === packageEcosystem && update.directory === directory,
  );
}

function assertGroupIncludes(update, groupName, patterns) {
  const group = update?.groups?.[groupName];
  if (!group) {
    fail(`Missing Dependabot group: ${groupName}`);
    return;
  }

  const actualPatterns = group.patterns || [];
  for (const pattern of patterns) {
    if (!actualPatterns.includes(pattern)) {
      fail(`Dependabot group "${groupName}" must include pattern "${pattern}"`);
    }
  }
}

const source = await readFile(configPath, 'utf-8');
const document = parseDocument(source, { prettyErrors: true });

if (document.errors.length > 0) {
  for (const error of document.errors) {
    fail(error.message);
  }
  process.exit();
}

const config = document.toJSON();
const response = await fetch(schemaUrl);
if (!response.ok) {
  throw new Error(`Failed to fetch Dependabot schema: ${response.status} ${response.statusText}`);
}

const schema = await response.json();
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

if (!validate(config)) {
  for (const error of validate.errors || []) {
    fail(formatAjvError(error));
  }
}

const npmUpdate = findUpdate(config, 'npm');
if (!npmUpdate) {
  fail('Missing Dependabot npm update block for directory "/"');
}

const actionsUpdate = findUpdate(config, 'github-actions');
if (!actionsUpdate) {
  fail('Missing Dependabot github-actions update block for directory "/"');
}

assertGroupIncludes(npmUpdate, 'electron-platform', ['electron', 'electron-builder']);
assertGroupIncludes(npmUpdate, 'cloakbrowser-runtime', ['cloakbrowser', 'playwright-core']);
assertGroupIncludes(actionsUpdate, 'github-actions-minor-patch', ['*']);

if (process.exitCode) {
  process.exit();
}

console.log('Dependabot configuration is valid');
