#!/usr/bin/env node

import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { ProcessWatchOperator } from './lib/process-watch-operator.mjs';
import { WATCH_OUTCOMES } from './lib/runtime-state-contracts.mjs';

const CONTROL_ACTIONS = Object.freeze({
  'repair-begin': 'begin-repair',
  'repair-restart': 'restart',
  'repair-verify': 'verify',
  'write-begin': 'begin-write',
  'write-complete': 'complete-write',
});

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function parseOptions(arguments_) {
  const options = new Map();
  for (let index = 0; index < arguments_.length; index += 2) {
    const name = arguments_[index];
    const value = arguments_[index + 1];
    if (typeof name !== 'string' || !/^--[a-z][a-z-]*$/u.test(name) || value === undefined) {
      fail('invalid-process-watch-arguments');
    }
    const key = name.slice(2);
    if (key !== 'path' && options.has(key)) fail('duplicate-process-watch-option');
    const values = options.get(key) ?? [];
    values.push(value);
    options.set(key, values);
  }
  return options;
}

function option(options, name, { required = false } = {}) {
  const values = options.get(name) ?? [];
  if (required && values.length !== 1) fail('missing-process-watch-option');
  if (values.length > 1) fail('duplicate-process-watch-option');
  return values[0];
}

function timeoutOption(options) {
  const value = option(options, 'timeout-seconds', { required: true });
  if (!/^[1-9]\d{0,5}$/u.test(value)) fail('invalid-watch-timeout');
  return Number(value);
}

function generationOption(options) {
  const value = option(options, 'generation', { required: true });
  if (!/^(?:0|[1-9]\d{0,9})$/u.test(value)) fail('invalid-process-watch-generation');
  const generation = Number(value);
  if (!Number.isSafeInteger(generation) || generation > 1_000_000_000) {
    fail('invalid-process-watch-generation');
  }
  return generation;
}

function outcomeOption(options) {
  const value = option(options, 'outcome', { required: true });
  if (!WATCH_OUTCOMES.includes(value) || value === 'running') fail('invalid-process-watch-outcome');
  return value;
}

function assertOnlyOptions(options, allowed) {
  for (const name of options.keys()) {
    if (!allowed.has(name)) fail('unknown-process-watch-option');
  }
}

export async function runProcessWatchCommand(arguments_, dependencies = {}) {
  if (!Array.isArray(arguments_) || arguments_.length === 0) fail('process-watch-action-required');
  const [action, ...optionArguments] = arguments_;
  const options = parseOptions(optionArguments);
  let execute;
  if (action === 'start') {
    assertOnlyOptions(options, new Set(['scenario', 'target', 'timeout-seconds']));
    const request = {
      scenarioId: option(options, 'scenario', { required: true }),
      targetSelector: option(options, 'target') ?? 'unspecified',
      timeoutSeconds: timeoutOption(options),
    };
    execute = (operator) => operator.start(request);
  } else if (action === 'status') {
    assertOnlyOptions(options, new Set(['watch-id']));
    const request = { watchId: option(options, 'watch-id') };
    execute = (operator) => operator.status(request);
  } else if (action === 'continuation') {
    assertOnlyOptions(options, new Set(['generation', 'outcome', 'watch-id']));
    const request = {
      generation: generationOption(options),
      outcome: outcomeOption(options),
      watchId: option(options, 'watch-id', { required: true }),
    };
    execute = (operator) => operator.continuation(request);
  } else if (action === 'wait') {
    assertOnlyOptions(options, new Set(['watch-id']));
    const request = { watchId: option(options, 'watch-id', { required: true }) };
    execute = (operator) => operator.wait(request);
  } else if (action === 'resume') {
    assertOnlyOptions(options, new Set(['timeout-seconds', 'watch-id']));
    const request = {
      timeoutSeconds: timeoutOption(options),
      watchId: option(options, 'watch-id'),
    };
    execute = (operator) => operator.resume(request);
  } else if (action === 'cancel') {
    assertOnlyOptions(options, new Set(['watch-id']));
    const request = { watchId: option(options, 'watch-id') };
    execute = (operator) => operator.cancel(request);
  } else if (Object.hasOwn(CONTROL_ACTIONS, action)) {
    assertOnlyOptions(options, new Set(['path', 'watch-id']));
    const candidatePaths = options.get('path');
    if (['write-begin', 'write-complete'].includes(action) && candidatePaths === undefined) {
      fail('repair-candidate-paths-required');
    }
    const request = {
      candidatePaths,
      watchId: option(options, 'watch-id'),
    };
    execute = (operator) => operator.control(CONTROL_ACTIONS[action], request);
  } else {
    fail('invalid-process-watch-action');
  }
  const operator = dependencies.operator ?? new ProcessWatchOperator(dependencies.operatorOptions);
  return execute(operator);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runProcessWatchCommand(process.argv.slice(2))
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => {
      const code = typeof error?.code === 'string' ? error.code : 'process-watch-command-failed';
      process.stderr.write(`${code}\n`);
      process.exitCode = 1;
    });
}
