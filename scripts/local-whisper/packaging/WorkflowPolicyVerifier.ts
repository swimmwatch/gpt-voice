import { parse } from 'yaml';

import { isRecord } from './contracts';

function parseWorkflow(text: string, name: string): Record<string, unknown> {
  const value = parse(text) as unknown;
  if (!isRecord(value) || !isRecord(value.on) || !isRecord(value.jobs)) {
    throw new Error(`Invalid ${name} workflow`);
  }
  return value;
}

function countOccurrences(text: string, value: string): number {
  return text.split(value).length - 1;
}

/** Enforces one fixture producer, digest-bound consumers, and Task-19-only Windows execution. */
export class WorkflowPolicyVerifier {
  public verify(input: {
    readonly fixtureWorkflow: string;
    readonly windowsWorkflow: string;
    readonly releaseWorkflow: string;
    readonly fedoraEntrypoint: string;
  }): void {
    const fixture = parseWorkflow(input.fixtureWorkflow, 'Local Whisper fixture');
    const fixtureJobs = fixture.jobs as Record<string, unknown>;
    const producer = fixtureJobs.fixture_producer;
    const consumer = fixtureJobs.linux_consumer;
    if (!isRecord(producer) || !isRecord(consumer) || consumer.needs !== 'fixture_producer') {
      throw new Error('Local Whisper fixture producer/consumer dependency is invalid');
    }
    if (countOccurrences(input.fixtureWorkflow, 'generate:local-whisper:packaging:fixture') !== 1) {
      throw new Error('Local Whisper fixture workflow must invoke exactly one producer');
    }
    const consumerText = JSON.stringify(consumer);
    if (
      consumerText.includes('generate:local-whisper:packaging:fixture') ||
      consumerText.includes('sign(') ||
      !consumerText.includes('actions/download-artifact@v8') ||
      !consumerText.includes('needs.fixture_producer.outputs.bundle_digest') ||
      !consumerText.includes('--mode=fixture')
    ) {
      throw new Error('Linux Local Whisper fixture consumer is not digest-bound');
    }

    const windows = parseWorkflow(input.windowsWorkflow, 'Local Whisper Windows consumer');
    const windowsOn = windows.on as Record<string, unknown>;
    if (Object.keys(windowsOn).length !== 1 || !('workflow_call' in windowsOn)) {
      throw new Error('Windows Local Whisper consumer must have only a reusable trigger');
    }
    const workflowCall = windowsOn.workflow_call;
    const windowsJobs = windows.jobs as Record<string, unknown>;
    const windowsConsumer = windowsJobs['windows-consumer-package'];
    if (
      !isRecord(workflowCall) ||
      !isRecord(workflowCall.inputs) ||
      !('bundle_digest' in workflowCall.inputs) ||
      !('task19_authorized' in workflowCall.inputs) ||
      !isRecord(windowsConsumer)
    ) {
      throw new Error('Windows Local Whisper consumer inputs are incomplete');
    }
    const windowsConsumerText = JSON.stringify(windowsConsumer);
    if (
      windowsConsumer.if !== '${{ inputs.task19_authorized }}' ||
      windowsConsumerText.includes('generate:local-whisper:packaging:fixture') ||
      windowsConsumerText.includes('sign(') ||
      !windowsConsumerText.includes('actions/download-artifact@v8') ||
      !windowsConsumerText.includes('local-whisper-public-fixture-v1') ||
      !windowsConsumerText.includes('inputs.bundle_digest') ||
      !windowsConsumerText.includes('--platform=win32')
    ) {
      throw new Error('Windows Local Whisper consumer is not deferred and digest-bound');
    }

    parseWorkflow(input.releaseWorkflow, 'release');
    if (
      input.releaseWorkflow.includes('--mode=fixture') ||
      !input.releaseWorkflow.includes('verify:local-whisper:packaging:release-guard') ||
      !input.fedoraEntrypoint.includes('verify:local-whisper:packaging:release-guard') ||
      input.fedoraEntrypoint.includes('--mode=fixture')
    ) {
      throw new Error('Local Whisper release-collection guard coverage is incomplete');
    }
  }
}
