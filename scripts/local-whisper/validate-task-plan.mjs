import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const workspaceRoot = path.resolve(import.meta.dirname, '..', '..');
const specificationRoot = path.join(workspaceRoot, 'docs', 'specs', 'local-whisper');
const tasksRoot = path.join(specificationRoot, 'tasks');
const manifestPath = path.join(tasksRoot, 'acceptance-owners.json');
const schemaPath = path.join(tasksRoot, 'acceptance-owners.schema.json');
const specificationPath = path.join(specificationRoot, 'spec.md');
const SPECIFICATION_REVISION = 25;
const PLAN_REVISION = 33;
const TASK_COUNT = 36;
const DEFERRED_TASKS = Object.freeze(['26']);
const SUPERSEDED_TASKS = Object.freeze(['21', '22', '27', '28', '29', '30', '31']);

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
const TASK_ID_PATTERN = /^(?:0[1-9]|1\d|2\d|3[0-6])$/u;
const TASK_FILE_PATTERN = /^(?:0[1-9]|1\d|2\d|3[0-6])_[a-z\d_]+\.md$/u;
const COMMAND_OWNER_TASK_ID_PATTERN = /^(?:0[1-9]|1\d|2[0-5]|3[2-6])$/u;
const COMMAND_ID_PATTERN = /^task-(?:0[1-9]|1\d|2[0-5]|3[2-6])-[a-z\d-]+$/u;
const ACCEPTANCE_ID_PATTERN = /^AC-AUTO-(?:00[1-9]|0[1-8]\d|09[01])$/u;
const SUPERSEDED_PACKET_STATUS = 'Status: **Superseded by approved plan revision 31. Do not execute this packet.**';
const CROSS_TASK_ACCEPTANCE_COMMAND_IDS = Object.freeze({
  'AC-AUTO-091': Object.freeze(['task-32-release-lifecycle-tests']),
});

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
    ...Array.from({ length: 36 }, (_, index) => `AC-AUTO-${String(index + 56).padStart(3, '0')}`),
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
  if (schema.$id !== 'https://gpt-voice.local/schemas/local-whisper-acceptance-owners-v2.json') {
    fail('schema $id is unexpected');
  }
  assertRecord(manifest, 'manifest');
  assertExactKeys(
    manifest,
    [
      'schemaVersion',
      'specificationRevision',
      'planRevision',
      'taskFiles',
      'deferredTasks',
      'supersededTasks',
      'verificationCommands',
      'automatedAcceptanceOwners',
    ],
    'manifest',
  );
  if (
    manifest.schemaVersion !== 2 ||
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
    fail('taskFiles must contain exactly Tasks 01 through 35');
  }
  if (taskFiles['23'] !== '23_main_window_residency_control.md') fail('Task 23 packet filename is unexpected');
  if (taskFiles['25'] !== '25_rtx50_readiness_closure.md') fail('Task 25 packet filename is unexpected');
  if (taskFiles['26'] !== '26_hardware_matched_nvidia_cuda_runtime_expansion.md') {
    fail('Task 26 packet filename is unexpected');
  }
  if (taskFiles['27'] !== '27_hosted_production_equivalent_ci.md') {
    fail('Task 27 packet filename is unexpected');
  }
  if (taskFiles['28'] !== '28_protected_signed_release_candidates.md') {
    fail('Task 28 packet filename is unexpected');
  }
  if (taskFiles['29'] !== '29_linux_rtx50_qualification.md') {
    fail('Task 29 packet filename is unexpected');
  }
  if (taskFiles['30'] !== '30_release_branch_preparation_and_pr_policy.md') {
    fail('Task 30 packet filename is unexpected');
  }
  if (taskFiles['31'] !== '31_hosted_production_equivalent_ci_builders.md') {
    fail('Task 31 packet filename is unexpected');
  }
  if (taskFiles['32'] !== '32_complete_production_release_pipeline.md') {
    fail('Task 32 packet filename is unexpected');
  }
  if (taskFiles['33'] !== '33_release_v2_4_0_alpha_1.md') fail('Task 33 packet filename is unexpected');
  if (taskFiles['34'] !== '34_test_v2_4_0_alpha_1_linux.md') fail('Task 34 packet filename is unexpected');
  if (taskFiles['35'] !== '35_test_v2_4_0_alpha_1_windows.md') {
    fail('Task 35 packet filename is unexpected');
  }
  if (taskFiles['36'] !== '36_release_v2_4_0.md') fail('Task 36 packet filename is unexpected');

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

function validateDeferredTasks(manifest, packetByTask, taskIds) {
  if (
    !Array.isArray(manifest.deferredTasks) ||
    manifest.deferredTasks.length !== DEFERRED_TASKS.length ||
    manifest.deferredTasks.some((task, index) => task !== DEFERRED_TASKS[index])
  ) {
    fail('deferredTasks must contain exactly Task 26');
  }
  const deferredTasks = new Set(manifest.deferredTasks);
  for (const task of deferredTasks) {
    if (!taskIds.includes(task) || !packetByTask.get(task)?.includes('Status: **Deferred · Non-executable**')) {
      fail(`deferred Task ${task} is missing its non-executable status`);
    }
  }
  return deferredTasks;
}

function validateSupersededTasks(manifest, packetByTask, taskIds) {
  if (
    !Array.isArray(manifest.supersededTasks) ||
    manifest.supersededTasks.length !== SUPERSEDED_TASKS.length ||
    manifest.supersededTasks.some((task, index) => task !== SUPERSEDED_TASKS[index])
  ) {
    fail('supersededTasks must contain exactly Tasks 21, 22, and 27 through 31');
  }
  const supersededTasks = new Set(manifest.supersededTasks);
  for (const task of supersededTasks) {
    if (!taskIds.includes(task) || !packetByTask.get(task)?.includes(SUPERSEDED_PACKET_STATUS)) {
      fail(`superseded Task ${task} is missing its historical status`);
    }
  }
  return supersededTasks;
}

function validateVerificationCommands(manifest, packetByTask, taskIds, nonCommandOwnerTasks) {
  const commandById = new Map();
  const commandCountByTask = new Map(
    taskIds.filter((task) => !nonCommandOwnerTasks.has(task)).map((task) => [task, 0]),
  );
  for (const [index, rawCommand] of manifest.verificationCommands.entries()) {
    const command = assertRecord(rawCommand, `verificationCommands[${index}]`);
    assertExactKeys(command, ['id', 'task', 'command'], `verificationCommands[${index}]`);
    if (!COMMAND_ID_PATTERN.test(command.id)) fail(`invalid verification command ID: ${command.id}`);
    if (
      !COMMAND_OWNER_TASK_ID_PATTERN.test(command.task) ||
      !packetByTask.has(command.task) ||
      nonCommandOwnerTasks.has(command.task)
    ) {
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

function assertCommandOwnerTask(owner, packetByTask, nonCommandOwnerTasks) {
  if (
    !COMMAND_OWNER_TASK_ID_PATTERN.test(owner.primaryTask) ||
    !packetByTask.has(owner.primaryTask) ||
    nonCommandOwnerTasks.has(owner.primaryTask)
  ) {
    fail(`${owner.acceptanceId} references unknown Task ${owner.primaryTask}`);
  }
}

function validateOwnerCommandIds(owner, commandById) {
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
    const allowedCrossTaskCommandIds = CROSS_TASK_ACCEPTANCE_COMMAND_IDS[owner.acceptanceId];
    if (command.task !== owner.primaryTask && !allowedCrossTaskCommandIds?.includes(command.id)) {
      fail(`${owner.acceptanceId} command ${commandId} belongs to a different task`);
    }
  }
}

function assertFixedAcceptanceOwners(ownersByAcceptanceId) {
  const expectedOwners = new Map([
    ['AC-AUTO-059', '23'],
    ['AC-AUTO-076', '23'],
    ['AC-AUTO-077', '23'],
    ['AC-AUTO-078', '25'],
    ['AC-AUTO-079', '25'],
    ['AC-AUTO-080', '32'],
    ['AC-AUTO-081', '25'],
    ['AC-AUTO-082', '32'],
    ['AC-AUTO-083', '32'],
    ['AC-AUTO-084', '32'],
    ['AC-AUTO-085', '32'],
    ['AC-AUTO-086', '32'],
    ['AC-AUTO-087', '32'],
    ['AC-AUTO-088', '32'],
    ['AC-AUTO-089', '32'],
    ['AC-AUTO-090', '32'],
    ['AC-AUTO-091', '36'],
  ]);
  for (const [acceptanceId, task] of expectedOwners) {
    if (ownersByAcceptanceId.get(acceptanceId) !== task) fail(`${acceptanceId} must be owned by Task ${task}`);
  }
}

function validateAcceptanceOwners(manifest, specification, packetByTask, commandById, nonCommandOwnerTasks) {
  const canonicalAcceptanceIds = expectedAcceptanceIds();
  const specificationAcceptanceIds = extractSpecificationAcceptanceIds(specification);
  if (
    specificationAcceptanceIds.length !== canonicalAcceptanceIds.length ||
    specificationAcceptanceIds.some((id, index) => id !== canonicalAcceptanceIds[index])
  ) {
    fail('specification automated acceptance IDs are not exactly AC-AUTO-001–054 and AC-AUTO-056–091');
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
    assertCommandOwnerTask(owner, packetByTask, nonCommandOwnerTasks);
    validateOwnerCommandIds(owner, commandById);
    if (!packetByTask.get(owner.primaryTask).includes(owner.acceptanceId)) {
      fail(`${owner.acceptanceId} is absent from primary Task ${owner.primaryTask}`);
    }
    ownersByAcceptanceId.set(owner.acceptanceId, owner.primaryTask);
  }
  const missingOwners = canonicalAcceptanceIds.filter((id) => !ownersByAcceptanceId.has(id));
  if (missingOwners.length > 0) fail(`missing primary owners: ${missingOwners.join(', ')}`);
  assertFixedAcceptanceOwners(ownersByAcceptanceId);
}

async function main() {
  const { manifest, schema, specification, taskDirectoryEntries } = await loadInputs();
  validateManifestShape(manifest, schema);
  const { packetByTask, taskIds } = await validateTaskFiles(manifest, taskDirectoryEntries);
  const deferredTasks = validateDeferredTasks(manifest, packetByTask, taskIds);
  const supersededTasks = validateSupersededTasks(manifest, packetByTask, taskIds);
  const nonCommandOwnerTasks = new Set([...deferredTasks, ...supersededTasks]);
  const commandById = validateVerificationCommands(manifest, packetByTask, taskIds, nonCommandOwnerTasks);
  validateAcceptanceOwners(manifest, specification, packetByTask, commandById, nonCommandOwnerTasks);

  process.stdout.write(
    'Local Whisper task plan is structurally valid: 36 packets, 5 current executable packets, 1 deferred packet, 7 superseded packets, 90 unique AC-AUTO owners.\n',
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
