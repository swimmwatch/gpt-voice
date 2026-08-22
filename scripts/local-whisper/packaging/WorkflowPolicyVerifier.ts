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

/** Enforces one fixture producer and a digest-bound, authorization-gated cross-platform consumer matrix. */
export class WorkflowPolicyVerifier {
  public verify(input: {
    readonly fixtureWorkflow: string;
    readonly releaseWorkflow: string;
    readonly fedoraEntrypoint: string;
  }): void {
    const fixture = parseWorkflow(input.fixtureWorkflow, 'Local Whisper fixture');
    const fixtureOn = fixture.on as Record<string, unknown>;
    const fixtureJobs = fixture.jobs as Record<string, unknown>;
    const producer = fixtureJobs.fixture_producer;
    const consumer = fixtureJobs.fixture_consumer;
    if (!isRecord(producer) || !isRecord(consumer) || consumer.needs !== 'fixture_producer') {
      throw new Error('Local Whisper fixture producer/consumer dependency is invalid');
    }
    if (countOccurrences(input.fixtureWorkflow, 'generate:local-whisper:packaging:fixture') !== 1) {
      throw new Error('Local Whisper fixture workflow must invoke exactly one producer');
    }
    if (!isRecord(fixtureOn.workflow_call) || !isRecord(fixtureOn.workflow_call.inputs)) {
      throw new Error('Local Whisper fixture workflow must expose its authorized reusable trigger');
    }
    const workflowCallInputs = fixtureOn.workflow_call.inputs;
    if (!('windows_qualification_authorized' in workflowCallInputs)) {
      throw new Error('Local Whisper fixture workflow lacks Windows qualification authorization');
    }
    const producerText = JSON.stringify(producer);
    const consumerText = JSON.stringify(consumer);
    if (
      !producerText.includes('emit-fixture-consumer-matrix') ||
      !producerText.includes('consumer_matrix') ||
      !consumerText.includes('fromJSON(needs.fixture_producer.outputs.consumer_matrix)') ||
      consumerText.includes('generate:local-whisper:packaging:fixture') ||
      consumerText.includes('sign(') ||
      !consumerText.includes('actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c') ||
      !consumerText.includes('needs.fixture_producer.outputs.bundle_digest') ||
      !consumerText.includes('--mode=fixture') ||
      !consumerText.includes('matrix.platform')
    ) {
      throw new Error('Local Whisper fixture consumer matrix is not digest-bound');
    }
    if (input.fixtureWorkflow.includes('local-whisper-packaging-windows.yml')) {
      throw new Error('Local Whisper fixture workflow must not depend on a duplicate Windows workflow');
    }

    parseWorkflow(input.releaseWorkflow, 'release');
    if (
      input.releaseWorkflow.includes('--mode=fixture') ||
      !input.releaseWorkflow.includes('verify:local-whisper:packaging:release-guard') ||
      !input.fedoraEntrypoint.includes('verify:local-whisper:packaging:release-guard') ||
      input.fedoraEntrypoint.includes('--mode=fixture') ||
      input.releaseWorkflow.includes('--mode=disabled') ||
      !input.releaseWorkflow.includes('--mode=production') ||
      !input.releaseWorkflow.includes('LOCAL_WHISPER_PRODUCTION_BUNDLE_DESCRIPTOR') ||
      !input.releaseWorkflow.includes('construct:local-whisper:production-bundle') ||
      !input.fedoraEntrypoint.includes('if (productionPackaging)') ||
      !input.fedoraEntrypoint.includes('--mode=production')
    ) {
      throw new Error('Local Whisper release-collection guard coverage is incomplete');
    }
  }
}
