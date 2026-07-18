import { LIVE_PCM_WORKLET_ASSET_URL } from './livePcmCaptureAsset';
import {
  LivePcmCaptureSession,
  type LivePcmCaptureCallbacks,
  type LivePcmCaptureResources,
} from './livePcmCaptureSession';

export const LIVE_PCM_WORKLET_PROCESSOR_NAME = 'gpt-voice-live-pcm-capture';

export async function startLivePcmCapture(
  stream: MediaStream,
  callbacks: LivePcmCaptureCallbacks,
): Promise<LivePcmCaptureSession> {
  const resources = await createBrowserCaptureResources(stream);
  return new LivePcmCaptureSession(resources, callbacks);
}

async function createBrowserCaptureResources(stream: MediaStream): Promise<LivePcmCaptureResources> {
  const context = new AudioContext();
  let source: MediaStreamAudioSourceNode | null = null;
  let worklet: AudioWorkletNode | null = null;

  try {
    await context.audioWorklet.addModule(LIVE_PCM_WORKLET_ASSET_URL);
    source = context.createMediaStreamSource(stream);
    worklet = new AudioWorkletNode(context, LIVE_PCM_WORKLET_PROCESSOR_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 0,
    });
    source.connect(worklet);
    await context.resume();

    const connectedSource = source;
    const connectedWorklet = worklet;
    return {
      inputSampleRate: context.sampleRate,
      close: () => context.close(),
      disconnect: () => disconnectAudioNodes(connectedSource, connectedWorklet),
      setMessageHandler: (handler) => {
        connectedWorklet.port.onmessage = handler ? (event: MessageEvent<unknown>) => handler(event.data) : null;
      },
      stopTracks: () => stopStreamTracks(stream),
    };
  } catch (error: unknown) {
    if (source && worklet) disconnectAudioNodes(source, worklet);
    else if (source) runCleanup(() => source?.disconnect());
    stopStreamTracks(stream);
    await context.close().catch(() => undefined);
    throw error;
  }
}

function disconnectAudioNodes(source: MediaStreamAudioSourceNode, worklet: AudioWorkletNode): void {
  runCleanup(() => source.disconnect());
  runCleanup(() => worklet.disconnect());
  runCleanup(() => worklet.port.close());
}

function stopStreamTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) runCleanup(() => track.stop());
}

function runCleanup(action: () => void): void {
  try {
    action();
  } catch {
    // Continue releasing the remaining browser audio resources.
  }
}
