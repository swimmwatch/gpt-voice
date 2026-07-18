/* global AudioWorkletProcessor, registerProcessor */

const PROCESSOR_NAME = 'gpt-voice-live-pcm-capture';

/** Copies browser input blocks into transferable operation-owned channel arrays. */
class LivePcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const inputChannels = inputs[0];
    if (!inputChannels || inputChannels.length === 0) return true;

    const channels = inputChannels.map((channel) => new Float32Array(channel));
    this.port.postMessage(
      { type: 'samples', channels },
      channels.map((channel) => channel.buffer),
    );
    return true;
  }
}

registerProcessor(PROCESSOR_NAME, LivePcmCaptureProcessor);
