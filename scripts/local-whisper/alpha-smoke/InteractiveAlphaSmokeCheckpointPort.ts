import process from 'node:process';
import { createInterface } from 'node:readline/promises';

import type { LinuxAlphaSmokeCheckpointPort } from './LinuxAlphaSmokeAdapter';

interface AlphaSmokeQuestionPort {
  close(): void;
  question(prompt: string): Promise<string>;
}

interface AlphaSmokeOutputPort {
  write(value: string): unknown;
}

interface InteractiveAlphaSmokeCheckpointDependencies {
  readonly input?: NodeJS.ReadStream;
  readonly output?: AlphaSmokeOutputPort;
  readonly prompts?: AlphaSmokeQuestionPort;
  readonly remainingMilliseconds?: (deadlineEpochMilliseconds: number) => number;
}

const CHECKPOINT_PROMPT_PREFIX = 'Complete the ordinary UI step, then enter checkpoint ';

/** Owns one interactive terminal conversation so each UI checkpoint consumes exactly one operator response. */
export class InteractiveAlphaSmokeCheckpointPort implements LinuxAlphaSmokeCheckpointPort {
  private readonly output: AlphaSmokeOutputPort;
  private readonly prompts: AlphaSmokeQuestionPort;
  private readonly requiresTty: boolean;
  private closed = false;
  private readonly remainingMilliseconds: (deadlineEpochMilliseconds: number) => number;

  public constructor(dependencies: InteractiveAlphaSmokeCheckpointDependencies = {}) {
    this.remainingMilliseconds = dependencies.remainingMilliseconds ?? ((deadline) => deadline - Date.now());
    const input = dependencies.input ?? process.stdin;
    this.output = dependencies.output ?? process.stdout;
    this.requiresTty = !dependencies.prompts && !input.isTTY;
    this.prompts = dependencies.prompts ?? createInterface({ input, output: this.output as NodeJS.WriteStream });
  }

  public async confirm(checkpoint: string, instruction?: string, deadlineEpochMilliseconds?: number): Promise<void> {
    if (this.closed) throw new Error('ALPHA_SMOKE_MANUAL_CHECKPOINT_CLOSED');
    if (this.requiresTty) throw new Error('ALPHA_SMOKE_MANUAL_CHECKPOINT_REQUIRES_TTY');
    if (deadlineEpochMilliseconds !== undefined && this.remainingMilliseconds(deadlineEpochMilliseconds) <= 0) {
      this.close();
      throw new Error('ALPHA_SMOKE_DEADLINE_EXHAUSTED');
    }
    if (instruction) this.output.write(`${instruction}\n`);
    const question = this.prompts.question(`${CHECKPOINT_PROMPT_PREFIX}${checkpoint}: `);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const response =
      deadlineEpochMilliseconds === undefined
        ? await question
        : await Promise.race([
            question,
            new Promise<never>((_resolve, reject) => {
              const remaining = this.remainingMilliseconds(deadlineEpochMilliseconds);
              timer = setTimeout(() => {
                reject(new Error('ALPHA_SMOKE_DEADLINE_EXHAUSTED'));
                this.close();
              }, remaining);
            }),
          ]).finally(() => {
            if (timer !== null) clearTimeout(timer);
          });
    if (response !== checkpoint) throw new Error('ALPHA_SMOKE_MANUAL_CHECKPOINT_INVALID');
  }

  public close(): void {
    if (this.closed) return;
    this.closed = true;
    this.prompts.close();
  }
}
