import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { BrowserContext, Page } from 'playwright-core';
import { ChatGPTVoiceProvider } from '@main/providers/ChatGPTVoiceProvider';

const CHATGPT_URL = 'https://chatgpt.com';
const SAVED_CONVERSATION_ID = 'abc12345-def6_7890';
const NEW_CONVERSATION_ID = 'new12345-def6_7890';

interface ChatGPTVoiceProviderInternals {
  context: BrowserContext | null;
  page: Page | null;
  textChatConversationId: string;
  openReusableChatGptComposer(page: Page): Promise<void>;
  saveCurrentTextChatConversationId(page: Page): void;
  sendChatGptTextPrompt(prompt: string): Promise<string>;
}

function internals(provider: ChatGPTVoiceProvider): ChatGPTVoiceProviderInternals {
  return provider as unknown as ChatGPTVoiceProviderInternals;
}

class FakeChatGptPage {
  assistantCountBeforeSubmit = 0;
  closed = false;
  events: string[] = [];
  generationActive = false;
  historyHydrates = true;
  newAssistantText = 'new answer';
  previousAssistantText = 'previous answer';
  redirectSavedConversationToHome = false;
  sendButtonAvailable = true;
  throwOnNewAssistantWait = false;
  urlValue = CHATGPT_URL;

  keyboard = {
    insertText: async (text: string) => {
      this.events.push(`insert:${text}`);
    },
    press: async (key: string) => {
      this.events.push(`press:${key}`);
      if (key === 'Enter' && this.urlValue === CHATGPT_URL) {
        this.urlValue = `${CHATGPT_URL}/c/${NEW_CONVERSATION_ID}`;
      }
    },
  };

  async route(): Promise<void> {
    this.events.push('route');
  }

  async goto(url: string): Promise<null> {
    this.events.push(`goto:${url}`);
    if (this.redirectSavedConversationToHome && url.includes('/c/')) {
      this.urlValue = CHATGPT_URL;
    } else {
      this.urlValue = url;
    }
    return null;
  }

  url(): string {
    return this.urlValue;
  }

  async waitForLoadState(): Promise<void> {
    this.events.push('load-state');
  }

  async waitForSelector(): Promise<void> {
    this.events.push('composer-ready');
  }

  async waitForFunction(_fn: unknown, arg: unknown): Promise<void> {
    if (typeof arg === 'string') {
      this.events.push('history-hydrated');
      if (!this.historyHydrates) {
        throw new Error('history did not hydrate');
      }
      return;
    }

    this.events.push('new-assistant-ready');
    if (this.throwOnNewAssistantWait) {
      throw new Error('response timed out');
    }
  }

  async evaluate(_fn: unknown, arg: unknown): Promise<unknown> {
    if (Array.isArray(arg) && arg.some((selector) => String(selector).includes('send-button'))) {
      this.events.push('send-click');
      if (this.sendButtonAvailable && this.urlValue === CHATGPT_URL) {
        this.urlValue = `${CHATGPT_URL}/c/${NEW_CONVERSATION_ID}`;
      }
      return this.sendButtonAvailable;
    }

    if (Array.isArray(arg)) {
      this.events.push('assistant-count');
      return {
        count: this.assistantCountBeforeSubmit,
        latestText: this.assistantCountBeforeSubmit > 0 ? this.previousAssistantText : '',
      };
    }

    if (typeof arg === 'object' && arg && 'selectors' in arg) {
      this.events.push('generation-control');
      return this.generationActive;
    }

    this.events.push('assistant-read');
    return this.newAssistantText;
  }

  locator(): { last(): { click(): Promise<void> } } {
    return {
      last: () => ({
        click: async () => {
          this.events.push('composer-click');
        },
      }),
    };
  }

  async waitForTimeout(delayMs: number): Promise<void> {
    this.events.push(`timeout:${delayMs}`);
  }

  isClosed(): boolean {
    return this.closed;
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  asPage(): Page {
    return this as unknown as Page;
  }
}

class FakeBrowserContext {
  newPageCalls = 0;

  constructor(private readonly textPage: Page) {}

  async newPage(): Promise<Page> {
    this.newPageCalls += 1;
    return this.textPage;
  }

  asContext(): BrowserContext {
    return this as unknown as BrowserContext;
  }
}

describe('ChatGPTVoiceProvider text prompt flow', () => {
  it('waits for reused conversation history before counting assistant messages', async () => {
    const originalNow = Date.now;
    let now = 1000;
    Date.now = () => now;

    try {
      const provider = new ChatGPTVoiceProvider();
      const textPage = new FakeChatGptPage();
      textPage.assistantCountBeforeSubmit = 1;
      const transcriptionPage = new FakeChatGptPage();
      const context = new FakeBrowserContext(textPage.asPage());
      const providerInternals = internals(provider);
      providerInternals.context = context.asContext();
      providerInternals.page = transcriptionPage.asPage();
      providerInternals.textChatConversationId = SAVED_CONVERSATION_ID;
      textPage.waitForTimeout = async (delayMs: number) => {
        textPage.events.push(`timeout:${delayMs}`);
        now += delayMs;
      };

      const result = await providerInternals.sendChatGptTextPrompt('prompt');

      assert.equal(result, 'new answer');
      assert.equal(context.newPageCalls, 1);
      assert.equal(
        transcriptionPage.events.some((event) => event.startsWith('goto:')),
        false,
      );
      assert.ok(textPage.events.indexOf('history-hydrated') < textPage.events.indexOf('assistant-count'));
      assert.ok(textPage.events.indexOf('assistant-count') < textPage.events.indexOf('composer-click'));
      assert.ok(textPage.events.indexOf('composer-click') < textPage.events.indexOf('send-click'));
      assert.ok(textPage.events.indexOf('composer-click') < textPage.events.indexOf('new-assistant-ready'));
      assert.ok(textPage.events.indexOf('new-assistant-ready') < textPage.events.indexOf('assistant-read'));
    } finally {
      Date.now = originalNow;
    }
  });

  it('clears a dead saved conversation id and opens a fresh chat', async () => {
    const provider = new ChatGPTVoiceProvider();
    const page = new FakeChatGptPage();
    page.redirectSavedConversationToHome = true;
    const providerInternals = internals(provider);
    providerInternals.textChatConversationId = SAVED_CONVERSATION_ID;

    await providerInternals.openReusableChatGptComposer(page.asPage());

    assert.equal(providerInternals.textChatConversationId, '');
    assert.deepEqual(
      page.events.filter((event) => event.startsWith('goto:')),
      [`goto:${CHATGPT_URL}/c/${SAVED_CONVERSATION_ID}`, `goto:${CHATGPT_URL}`],
    );
  });

  it('clears a saved conversation id when history never hydrates', async () => {
    const provider = new ChatGPTVoiceProvider();
    const page = new FakeChatGptPage();
    page.historyHydrates = false;
    const providerInternals = internals(provider);
    providerInternals.textChatConversationId = SAVED_CONVERSATION_ID;

    await providerInternals.openReusableChatGptComposer(page.asPage());

    assert.equal(providerInternals.textChatConversationId, '');
    assert.deepEqual(
      page.events.filter((event) => event.startsWith('goto:')),
      [`goto:${CHATGPT_URL}/c/${SAVED_CONVERSATION_ID}`, `goto:${CHATGPT_URL}`],
    );
  });

  it('saves the current conversation id even when response waiting fails', async () => {
    const provider = new ChatGPTVoiceProvider();
    const textPage = new FakeChatGptPage();
    textPage.throwOnNewAssistantWait = true;
    const context = new FakeBrowserContext(textPage.asPage());
    const providerInternals = internals(provider);
    providerInternals.context = context.asContext();
    let savedUrl = '';
    providerInternals.saveCurrentTextChatConversationId = (page: Page) => {
      savedUrl = page.url();
    };

    await assert.rejects(providerInternals.sendChatGptTextPrompt('prompt'), /response timed out/);

    assert.equal(savedUrl, `${CHATGPT_URL}/c/${NEW_CONVERSATION_ID}`);
  });

  it('falls back to Enter when the ChatGPT send button is unavailable', async () => {
    const originalNow = Date.now;
    let now = 1000;
    Date.now = () => now;

    try {
      const provider = new ChatGPTVoiceProvider();
      const textPage = new FakeChatGptPage();
      textPage.sendButtonAvailable = false;
      const context = new FakeBrowserContext(textPage.asPage());
      const providerInternals = internals(provider);
      providerInternals.context = context.asContext();
      providerInternals.page = new FakeChatGptPage().asPage();
      textPage.waitForTimeout = async (delayMs: number) => {
        textPage.events.push(`timeout:${delayMs}`);
        now += delayMs;
      };

      const result = await providerInternals.sendChatGptTextPrompt('prompt');

      assert.equal(result, 'new answer');
      assert.ok(textPage.events.indexOf('send-click') < textPage.events.indexOf('press:Enter'));
      assert.equal(textPage.url(), `${CHATGPT_URL}/c/${NEW_CONVERSATION_ID}`);
    } finally {
      Date.now = originalNow;
    }
  });
});
