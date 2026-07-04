const CHATGPT_CONVERSATION_ID_PATTERN = /^[A-Za-z0-9_-]{8,}$/;

export interface ChatGptTextChatState {
  conversationId: string;
  savedAt: number;
}

export function normalizeChatGptConversationId(value: unknown): string {
  if (typeof value !== 'string') return '';

  const trimmed = value.trim();
  return CHATGPT_CONVERSATION_ID_PATTERN.test(trimmed) ? trimmed : '';
}

export function extractChatGptConversationId(urlString: string): string {
  try {
    const url = new URL(urlString);
    const [, section, rawConversationId] = url.pathname.split('/');
    if (section !== 'c') return '';

    return normalizeChatGptConversationId(decodeURIComponent(rawConversationId || ''));
  } catch {
    return '';
  }
}

export function buildChatGptConversationUrl(baseUrl: string, conversationId: string): string {
  const normalizedConversationId = normalizeChatGptConversationId(conversationId);
  if (!normalizedConversationId) return baseUrl;

  return `${baseUrl.replace(/\/+$/, '')}/c/${encodeURIComponent(normalizedConversationId)}`;
}

export function parseChatGptTextChatState(value: unknown): ChatGptTextChatState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const state = value as Partial<ChatGptTextChatState>;
  const conversationId = normalizeChatGptConversationId(state.conversationId);
  const savedAt = typeof state.savedAt === 'number' && Number.isFinite(state.savedAt) ? state.savedAt : 0;
  if (!conversationId) return null;

  return {
    conversationId,
    savedAt,
  };
}
