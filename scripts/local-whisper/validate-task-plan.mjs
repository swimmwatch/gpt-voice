import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const workspaceRoot = path.resolve(import.meta.dirname, '..', '..');
const specificationRoot = path.join(workspaceRoot, 'docs', 'specs', 'local-whisper');
const tasksRoot = path.join(specificationRoot, 'tasks');
const manifestPath = path.join(tasksRoot, 'acceptance-owners.json');
const schemaPath = path.join(tasksRoot, 'acceptance-owners.schema.json');
const specificationPath = path.join(specificationRoot, 'spec.md');
const SPECIFICATION_REVISION = 17;
const PLAN_REVISION = 23;
const TASK_COUNT = 26;

const REQUIRED_REPLACEMENT_HEADINGS = [
  'Outcome',
  'Prerequisites',
  'Owned Requirements',
  'In Scope',
  'Out Of Scope',
  'Task Contract',
  'Contracts And Boundaries',
  'Expected Files Or Components',
  'Acceptance Criteria',
  'Verification',
  'Failure And Rollback',
  'Manual Gates',
  'References',
  'Completion And Handoff',
];
const TASK_ID_PATTERN = /^(?:0[1-9]|1\d|2[0-6])$/u;
const TASK_FILE_PATTERN = /^(?:0[1-9]|1\d|2[0-6])_[a-z\d_]+\.md$/u;
const COMMAND_ID_PATTERN = /^task-(?:0[1-9]|1\d|2[0-6])-[a-z\d-]+$/u;
const ACCEPTANCE_ID_PATTERN = /^AC-AUTO-(?:00[1-9]|0[1-5]\d|06\d|07\d|08[0-2])$/u;

function fail(message) {
  throw new Error(`Local Whisper task-plan validation failed: ${message}`);
}

function assertRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function assertExactKeys(value, expectedKeys, label) {
  const actualKeys = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (actualKeys.length !== expected.length || actualKeys.some((key, index) => key !== expected[index])) {
    fail(`${label} has unexpected or missing keys`);
  }
}

function expectedAcceptanceIds() {
  return [
    ...Array.from({ length: 54 }, (_, index) => `AC-AUTO-${String(index + 1).padStart(3, '0')}`),
    ...Array.from({ length: 27 }, (_, index) => `AC-AUTO-${String(index + 56).padStart(3, '0')}`),
  ];
}

function extractSpecificationAcceptanceIds(specification) {
  return [...specification.matchAll(/^\| (AC-AUTO-\d{3}) \|/gmu)].map((match) => match[1]);
}

function verificationSection(packet) {
  const headingMatch = /^## Verification\s*$/mu.exec(packet);
  if (!headingMatch) fail('packet is missing a Verification section');
  const remainder = packet.slice(headingMatch.index + headingMatch[0].length);
  const nextHeadingIndex = remainder.search(/^## /mu);
  return nextHeadingIndex < 0 ? remainder : remainder.slice(0, nextHeadingIndex);
}

function assertReplacementHeadings(packet, task) {
  if (Number(task) < 8) return;
  const headings = new Set([...packet.matchAll(/^## ([^\r\n]+)$/gmu)].map((match) => match[1]));
  for (const heading of REQUIRED_REPLACEMENT_HEADINGS) {
    if (!headings.has(heading)) fail(`Task ${task} is missing heading: ${heading}`);
  }
}

function validateManifestShape(manifest, schema) {
  assertRecord(schema, 'schema');
  if (schema.$id !== 'https://gpt-voice.local/schemas/local-whisper-acceptance-owners-v1.json') {
    fail('schema $id is unexpected');
  }
  assertRecord(manifest, 'manifest');
  assertExactKeys(
    manifest,
    ['schemaVersion', 'specificationRevision', 'planRevision', 'taskFiles', 'verificationCommands', 'automatedAcceptanceOwners'],
    'manifest',
  );
  if (
    manifest.schemaVersion !== 1 ||
    manifest.specificationRevision !== SPECIFICATION_REVISION ||
    manifest.planRevision !== PLAN_REVISION
  ) {
    fail('manifest version is unexpected');
  }
  if (!Array.isArray(manifest.verificationCommands)) fail('verificationCommands must be an array');
  if (!Array.isArray(manifest.automatedAcceptanceOwners)) fail('automatedAcceptanceOwners must be an array');
}

async function loadInputs() {
  const [manifestText, schemaText, specification, taskDirectoryEntries] = await Promise.all([
    readFile(manifestPath, 'utf8'),
    readFile(schemaPath, 'utf8'),
    readFile(specificationPath, 'utf8'),
    readdir(tasksRoot, { withFileTypes: true }),
  ]);
  return {
    manifest: JSON.parse(manifestText),
    schema: JSON.parse(schemaText),
    specification,
    taskDirectoryEntries,
  };
}

async function validateTaskFiles(manifest, taskDirectoryEntries) {
  const taskFiles = assertRecord(manifest.taskFiles, 'taskFiles');
  const taskIds = Object.keys(taskFiles).sort();
  const expectedTaskIds = Array.from({ length: TASK_COUNT }, (_, index) => String(index + 1).padStart(2, '0'));
  if (taskIds.length !== expectedTaskIds.length || taskIds.some((task, index) => task !== expectedTaskIds[index])) {
    fail('taskFiles must contain exactly Tasks 01 through 26');
  }
  if (taskFiles['23'] !== '23_main_window_residency_control.md') fail('Task 23 packet filename is unexpected');
  if (taskFiles['25'] !== '25_linux_qualification_finalization.md') fail('Task 25 packet filename is unexpected');
  if (taskFiles['26'] !== '26_hardware_matched_nvidia_cuda_runtime_expansion.md') {
    fail('Task 26 packet filename is unexpected');
  }

  const numberedFiles = taskDirectoryEntries
    .filter((entry) => entry.isFile() && /^\d{2}_.*\.md$/u.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const declaredFiles = Object.values(taskFiles).sort();
  if (
    numberedFiles.length !== declaredFiles.length ||
    numberedFiles.some((fileName, index) => fileName !== declaredFiles[index])
  ) {
    fail('numbered packet files do not exactly match taskFiles');
  }

  const packetByTask = new Map();
  for (const task of taskIds) {
    const fileName = taskFiles[task];
    if (!TASK_ID_PATTERN.test(task) || typeof fileName !== 'string' || !TASK_FILE_PATTERN.test(fileName)) {
      fail(`Task ${task} has an invalid packet filename`);
    }
    if (!fileName.startsWith(`${task}_`)) fail(`Task ${task} packet filename has the wrong prefix`);
    const packet = await readFile(path.join(tasksRoot, fileName), 'utf8');
    assertReplacementHeadings(packet, task);
    packetByTask.set(task, packet);
  }
  return { packetByTask, taskIds };
}

function validateVerificationCommands(manifest, packetByTask, taskIds) {
  const commandById = new Map();
  const commandCountByTask = new Map(taskIds.map((task) => [task, 0]));
  for (const [index, rawCommand] of manifest.verificationCommands.entries()) {
    const command = assertRecord(rawCommand, `verificationCommands[${index}]`);
    assertExactKeys(command, ['id', 'task', 'command'], `verificationCommands[${index}]`);
    if (!COMMAND_ID_PATTERN.test(command.id)) fail(`invalid verification command ID: ${command.id}`);
    if (!TASK_ID_PATTERN.test(command.task) || !packetByTask.has(command.task)) {
      fail(`verification command ${command.id} references unknown Task ${command.task}`);
    }
    if (typeof command.command !== 'string' || !/^rtk [^\r\n]+$/u.test(command.command)) {
      fail(`verification command ${command.id} is not one exact rtk command`);
    }
    if (commandById.has(command.id)) fail(`duplicate verification command ID: ${command.id}`);
    if (!command.id.startsWith(`task-${command.task}-`)) {
      fail(`verification command ${command.id} does not match Task ${command.task}`);
    }
    const packetVerification = verificationSection(packetByTask.get(command.task));
    if (!packetVerification.split(/\r?\n/u).includes(command.command)) {
      fail(`verification command ${command.id} is absent from Task ${command.task} Verification`);
    }
    commandById.set(command.id, command);
    commandCountByTask.set(command.task, commandCountByTask.get(command.task) + 1);
  }
  for (const [task, count] of commandCountByTask) {
    if (count === 0) fail(`Task ${task} has no registered exact verification command`);
  }
  const task23Commands = manifest.verificationCommands
    .filter((command) => command.task === '23')
    .map((command) => command.command);
  if (
    JSON.stringify(task23Commands) !==
    JSON.stringify([
      'rtk npm run test:local-whisper:ipc',
      'rtk npm run test:local-whisper:composition',
      'rtk npm run verify:local-whisper:ui',
    ])
  ) {
    fail('Task 23 must register exactly its IPC, composition, and UI verification commands');
  }
  return commandById;
}

function validateAcceptanceOwners(manifest, specification, packetByTask, commandById) {
  const canonicalAcceptanceIds = expectedAcceptanceIds();
  const specificationAcceptanceIds = extractSpecificationAcceptanceIds(specification);
  if (
    specificationAcceptanceIds.length !== canonicalAcceptanceIds.length ||
    specificationAcceptanceIds.some((id, index) => id !== canonicalAcceptanceIds[index])
  ) {
    fail('specification automated acceptance IDs are not exactly AC-AUTO-001–054 and AC-AUTO-056–082');
  }

  const ownersByAcceptanceId = new Map();
  for (const [index, rawOwner] of manifest.automatedAcceptanceOwners.entries()) {
    const owner = assertRecord(rawOwner, `automatedAcceptanceOwners[${index}]`);
    assertExactKeys(
      owner,
      ['acceptanceId', 'primaryTask', 'verificationCommandIds'],
      `automatedAcceptanceOwners[${index}]`,
    );
    if (typeof owner.acceptanceId !== 'string' || !ACCEPTANCE_ID_PATTERN.test(owner.acceptanceId)) {
      fail(`invalid canonical acceptance ID at owner index ${index}`);
    }
    if (owner.acceptanceId !== canonicalAcceptanceIds[index]) {
      fail(`acceptance owner ordering differs at index ${index}`);
    }
    if (!canonicalAcceptanceIds.includes(owner.acceptanceId)) fail(`unknown acceptance ID: ${owner.acceptanceId}`);
    if (ownersByAcceptanceId.has(owner.acceptanceId)) fail(`duplicate primary owner: ${owner.acceptanceId}`);
    if (!TASK_ID_PATTERN.test(owner.primaryTask) || !packetByTask.has(owner.primaryTask)) {
      fail(`${owner.acceptanceId} references unknown Task ${owner.primaryTask}`);
    }
    if (!Array.isArray(owner.verificationCommandIds) || owner.verificationCommandIds.length === 0) {
      fail(`${owner.acceptanceId} has no verification command references`);
    }
    const commandIds = new Set();
    for (const commandId of owner.verificationCommandIds) {
      if (typeof commandId !== 'string' || !COMMAND_ID_PATTERN.test(commandId)) {
        fail(`${owner.acceptanceId} contains an invalid verification command reference`);
      }
      if (commandIds.has(commandId)) fail(`${owner.acceptanceId} repeats verification command ${commandId}`);
      commandIds.add(commandId);
      const command = commandById.get(commandId);
      if (!command) fail(`${owner.acceptanceId} references nonexistent verification command ${commandId}`);
      if (command.task !== owner.primaryTask) {
        fail(`${owner.acceptanceId} command ${commandId} belongs to a different task`);
      }
    }
    if (!packetByTask.get(owner.primaryTask).includes(owner.acceptanceId)) {
      fail(`${owner.acceptanceId} is absent from primary Task ${owner.primaryTask}`);
    }
    ownersByAcceptanceId.set(owner.acceptanceId, owner.primaryTask);
  }
  const missingOwners = canonicalAcceptanceIds.filter((id) => !ownersByAcceptanceId.has(id));
  if (missingOwners.length > 0) fail(`missing primary owners: ${missingOwners.join(', ')}`);
  for (const acceptanceId of ['AC-AUTO-059', 'AC-AUTO-076', 'AC-AUTO-077']) {
    if (ownersByAcceptanceId.get(acceptanceId) !== '23') fail(`${acceptanceId} must be owned by Task 23`);
  }
  for (const acceptanceId of ['AC-AUTO-078', 'AC-AUTO-079', 'AC-AUTO-080', 'AC-AUTO-081', 'AC-AUTO-082']) {
    if (ownersByAcceptanceId.get(acceptanceId) !== '26') fail(`${acceptanceId} must be owned by Task 26`);
  }
}

async function main() {
  const { manifest, schema, specification, taskDirectoryEntries } = await loadInputs();
  validateManifestShape(manifest, schema);
  const { packetByTask, taskIds } = await validateTaskFiles(manifest, taskDirectoryEntries);
  const commandById = validateVerificationCommands(manifest, packetByTask, taskIds);
  validateAcceptanceOwners(manifest, specification, packetByTask, commandById);

  process.stdout.write('Local Whisper task plan is structurally valid: 26 packets, 81 unique AC-AUTO owners.\n');
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
