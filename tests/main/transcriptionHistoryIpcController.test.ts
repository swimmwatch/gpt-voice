import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TranscriptionHistoryIpcController } from '@main/services/transcriptionHistoryIpcController';
import { RecordingTranscriptionHistoryRepository } from './repositories/recordingTranscriptionHistoryRepository';

describe('transcription history IPC controller', () => {
  it('lists, copies, and clears history through an injected state-owning repository', () => {
    const repository = new RecordingTranscriptionHistoryRepository();
    const clipboard: string[] = [];
    const logs: unknown[][] = [];
    const controller = new TranscriptionHistoryIpcController(repository, {
      logger: { warn: (...args: unknown[]) => logs.push(args) },
      writeClipboardText: (text) => clipboard.push(text),
    });
    const saved = repository.addEntry({
      providerId: 'chatgpt',
      providerName: 'ChatGPT Web',
      requestedAt: '2026-07-27T12:00:00.000Z',
      text: 'history text',
    });

    assert.deepEqual(controller.list({ limit: 1 }), {
      hasMore: false,
      items: [saved],
      limit: 1,
      offset: 0,
      total: 1,
    });
    assert.deepEqual(controller.copyText(saved.id), { success: true });
    assert.deepEqual(clipboard, ['history text']);
    assert.deepEqual(controller.copyText('invalid-id'), {
      error: 'History entry not found',
      success: false,
    });
    assert.deepEqual(controller.clear(), { success: true });
    assert.equal(controller.list().total, 0);
    assert.deepEqual(logs, []);
  });

  it('preserves the renderer-safe copy failure result', () => {
    const repository = new RecordingTranscriptionHistoryRepository();
    const logs: unknown[][] = [];
    const controller = new TranscriptionHistoryIpcController(repository, {
      logger: { warn: (...args: unknown[]) => logs.push(args) },
      writeClipboardText(): never {
        throw new Error('clipboard unavailable');
      },
    });
    const saved = repository.addEntry({
      providerId: 'openai-api',
      providerName: 'OpenAI API',
      requestedAt: '2026-07-27T12:00:00.000Z',
      text: 'history text',
    });

    assert.deepEqual(controller.copyText(saved.id), {
      error: 'Failed to copy history text',
      success: false,
    });
    assert.deepEqual(logs, [
      [
        'Failed to copy transcription history text:',
        {
          error: 'clipboard unavailable',
          id: saved.id,
        },
      ],
    ]);
  });
});
