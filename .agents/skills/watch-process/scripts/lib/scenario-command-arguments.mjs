import {
  SUBSTITUTION_KEYS,
  SUBSTITUTION_PATTERN,
  containsControlCharacter,
  fail,
  requireArray,
  requireFiniteNumber,
  requireString,
} from './scenario-contract-support.mjs';

/** Parses one command argument under the exact whole-token substitution grammar. */
export function parseCommandArgument(value, location = '$.argument') {
  const argument = requireString(value, location);
  const substitution = SUBSTITUTION_PATTERN.exec(argument);
  if (substitution !== null) {
    const key = `${substitution[1]}.${substitution[2]}`;
    if (!SUBSTITUTION_KEYS.has(key)) fail('unknown-substitution', location);
    return Object.freeze({ kind: 'substitution', key });
  }
  if (argument.includes('{{') || argument.includes('}}')) fail('invalid-substitution-syntax', location);
  return Object.freeze({ kind: 'literal', value: argument });
}

function requireSafeSubstitutionString(value, location) {
  const result = requireString(value, location, 1);
  if (containsControlCharacter(result) || result.includes('{{') || result.includes('}}')) {
    fail('invalid-substitution-value', location);
  }
  return result;
}

/** Owns one single-pass expansion context for command arguments. */
export class CommandArgumentResolver {
  #values;

  constructor(values) {
    this.#values = values;
  }

  resolve(args) {
    const argumentsArray = requireArray(args, '$.args', 0, 200);
    return argumentsArray.map((argument, index) => this.#resolveArgument(argument, index));
  }

  #resolveArgument(argument, index) {
    const parsed = parseCommandArgument(argument, `$.args[${index}]`);
    return parsed.kind === 'literal' ? parsed.value : this.#readValue(parsed.key);
  }

  #readValue(key) {
    const valueMap = {
      'watch.id': this.#values?.watch?.id,
      'workspace.root': this.#values?.workspace?.root,
      'invocation.timeout_seconds': this.#values?.invocation?.timeout_seconds,
      'target.selector': this.#values?.target?.selector,
      'target.id': this.#values?.target?.id,
      'target.source_sha': this.#values?.target?.source_sha,
      'attempt.number': this.#values?.attempt?.number,
    };
    const value = valueMap[key];
    if (key === 'invocation.timeout_seconds' || key === 'attempt.number') {
      return String(requireFiniteNumber(value, `$.substitutions.${key}`, 1, Number.MAX_SAFE_INTEGER, true));
    }
    return requireSafeSubstitutionString(value, `$.substitutions.${key}`);
  }
}

/** Resolves only declared substitutions once, into an argv array without shell interpolation. */
export function resolveCommandArguments(args, values) {
  return new CommandArgumentResolver(values).resolve(args);
}
