import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020';
import {
  alphaSmokeDigest,
  parseAlphaSmokeAttempt,
  type AlphaSmokeAttempt,
  type AlphaSmokeResult,
} from './AlphaSmokeProtocol';

/** Compiles current closed schemas once per owner; historical v1 schemas remain untouched. */
export class AlphaSmokeSchemaValidator {
  private readonly attemptValidator: ValidateFunction;
  private readonly resultValidator: ValidateFunction;
  private readonly indexValidator: ValidateFunction;
  public constructor() {
    const ajv = new Ajv2020({ strict: true, allErrors: false });
    const read = (name: string): object =>
      JSON.parse(readFileSync(path.join(__dirname, 'schemas', name), 'utf8')) as object;
    ajv.addSchema(read('alpha-smoke-input.schema.json'), 'alpha-smoke-input.schema.json');
    this.attemptValidator = ajv.compile(read('alpha-smoke-attempt-v2.schema.json'));
    this.resultValidator = ajv.compile(read('alpha-smoke-result-v2.schema.json'));
    this.indexValidator = ajv.compile(read('alpha-smoke-evidence-index-v2.schema.json'));
  }

  public attempt(value: unknown): AlphaSmokeAttempt {
    if (!this.attemptValidator(value)) throw new Error('ALPHA_SMOKE_STATE_INVALID');
    return parseAlphaSmokeAttempt(value);
  }

  public result(value: unknown): AlphaSmokeResult {
    if (!this.resultValidator(value)) throw new Error('ALPHA_SMOKE_RESULT_INVALID');
    const result = value as AlphaSmokeResult;
    const { resultDigest, ...body } = result;
    if (alphaSmokeDigest(body) !== resultDigest) throw new Error('ALPHA_SMOKE_RESULT_DIGEST_INVALID');
    return result;
  }

  public index(value: unknown, result: AlphaSmokeResult): void {
    if (!this.indexValidator(value)) throw new Error('ALPHA_SMOKE_INDEX_INVALID');
    const index = value as Record<string, unknown>;
    for (const key of ['attemptId', 'deploymentDigest', 'inputDigest', 'platform', 'resultDigest', 'target'] as const) {
      if (index[key] !== result[key]) throw new Error('ALPHA_SMOKE_INDEX_BINDING_INVALID');
    }
  }
}
