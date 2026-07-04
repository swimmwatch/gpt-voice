import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChatGptConversationUrl,
  extractChatGptConversationId,
  normalizeChatGptConversationId,
  parseChatGptTextChatState,
} from '@main/providers/chatgptTextChatState';

describe('chatgptTextChatState', () => {
  describe('normalizeChatGptConversationId', () => {
    it('accepts conversation ids used in ChatGPT URLs', () => {
      assert.equal(normalizeChatGptConversationId('abc12345-def6_7890'), 'abc12345-def6_7890');
    });

    it('rejects empty, short, or path-like values', () => {
      assert.equal(normalizeChatGptConversationId(''), '');
      assert.equal(normalizeChatGptConversationId('short'), '');
      assert.equal(normalizeChatGptConversationId('../abc12345'), '');
    });
  });

  describe('extractChatGptConversationId', () => {
    it('extracts a reusable conversation id from a ChatGPT conversation URL', () => {
      assert.equal(
        extractChatGptConversationId('https://chatgpt.com/c/abc12345-def6_7890?model=gpt-5'),
        'abc12345-def6_7890',
      );
    });

    it('returns an empty id for non-conversation URLs', () => {
      assert.equal(extractChatGptConversationId('https://chatgpt.com/'), '');
      assert.equal(extractChatGptConversationId('not a url'), '');
    });
  });

  describe('buildChatGptConversationUrl', () => {
    it('builds a ChatGPT conversation URL from a stored id', () => {
      assert.equal(
        buildChatGptConversationUrl('https://chatgpt.com/', 'abc12345-def6_7890'),
        'https://chatgpt.com/c/abc12345-def6_7890',
      );
    });

    it('falls back to the base URL for invalid ids', () => {
      assert.equal(buildChatGptConversationUrl('https://chatgpt.com', '../abc12345'), 'https://chatgpt.com');
    });
  });

  describe('parseChatGptTextChatState', () => {
    it('parses a valid saved state', () => {
      assert.deepEqual(parseChatGptTextChatState({ conversationId: 'abc12345-def6_7890', savedAt: 123 }), {
        conversationId: 'abc12345-def6_7890',
        savedAt: 123,
      });
    });

    it('rejects invalid saved state without returning partial data', () => {
      assert.equal(parseChatGptTextChatState({ conversationId: '../abc12345', savedAt: 123 }), null);
      assert.equal(parseChatGptTextChatState(null), null);
    });
  });
});
