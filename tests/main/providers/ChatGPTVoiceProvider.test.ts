import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { BrowserContext, Page, Response } from 'playwright-core';
import { ChatGPTVoiceProvider } from '@main/providers/ChatGPTVoiceProvider';
import type { PrettifyReasoning } from '@shared/prettifySettings';

const CHATGPT_URL = 'https://chatgpt.com';
const SAVED_CONVERSATION_ID = 'abc12345-def6_7890';
const NEW_CONVERSATION_ID = 'new12345-def6_7890';

interface ChatGPTVoiceProviderInternals {
  accessToken: string;
  context: BrowserContext | null;
  page: Page | null;
  textPage: Page | null;
  textChatConversationId: string;
  openReusableChatGptComposer(page: Page): Promise<void>;
  saveCurrentTextChatConversationId(page: Page): void;
  sendChatGptTextPrompt(
    prompt: string,
    reasoning?: PrettifyReasoning,
    signal?: AbortSignal,
    cancellationError?: string,
  ): Promise<string>;
}

function internals(provider: ChatGPTVoiceProvider): ChatGPTVoiceProviderInternals {
  return provider as unknown as ChatGPTVoiceProviderInternals;
}

class FakeChatGptPage {
  assistantCountBeforeSubmit = 0;
  authSessionHasAccessToken = true;
  authSessionHasUser = true;
  blockingError = '';
  blockingErrorAfterSubmit = '';
  closed = false;
  composerText = '';
  conversationResponseStatus = 200;
  currentModeLabel = 'Fast';
  events: string[] = [];
  firstSendDoesNotSubmit = false;
  generationActive = false;
  historyHydrates = true;
  modeButtonAvailable = true;
  modeMenuOpen = false;
  modeOptions = ['Fast', 'Thinking', 'Pro'];
  newAssistantText = 'new answer';
  previousAssistantText = 'previous answer';
  redirectSavedConversationToHome = false;
  responseListeners: Array<(response: Response) => void> = [];
  sendClickCount = 0;
  sendButtonAvailable = true;
  userMessageCount = 0;
  urlValue = CHATGPT_URL;

  keyboard = {
    insertText: async (text: string) => {
      this.composerText = text;
      this.events.push(`insert:${text}`);
    },
    press: async (key: string) => {
      this.events.push(`press:${key}`);
      if (key === 'Backspace') {
        this.composerText = '';
      }
      if (key === 'Enter') {
        this.submitPrompt();
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
    if (typeof arg === 'object' && arg && 'messageSelectors' in arg) {
      this.events.push('history-hydrated');
      if (!this.historyHydrates) {
        throw new Error('history did not hydrate');
      }
      return;
    }

    if (typeof arg === 'string') {
      this.events.push('history-hydrated');
      if (!this.historyHydrates) {
        throw new Error('history did not hydrate');
      }
      return;
    }

    if (Array.isArray(arg)) {
      this.events.push('send-ready');
      if (!this.sendButtonAvailable) {
        throw new Error('send button unavailable');
      }
      return;
    }

    this.events.push('wait-for-function');
  }

  async evaluate(_fn: unknown, arg: unknown): Promise<unknown> {
    if (typeof arg === 'object' && arg && 'action' in arg) {
      return this.handleModeAction(arg as { action?: unknown; preferredModes?: unknown });
    }

    if (typeof arg === 'number') {
      this.events.push('auth-session');
      return {
        hasAccessToken: this.authSessionHasAccessToken,
        hasUser: this.authSessionHasUser,
        status: 200,
      };
    }

    if (Array.isArray(arg) && arg.some((selector) => String(selector).includes('send-button'))) {
      this.events.push('send-click');
      this.sendClickCount += 1;
      if (this.sendButtonAvailable) {
        this.submitPrompt();
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

    if (typeof arg === 'object' && arg) {
      if ('composerSelector' in arg && 'userMessageSelector' in arg && !('assistantMessageSelectors' in arg)) {
        this.events.push('submission-state');
        return {
          composerTextLength: this.composerText.trim().length,
          userMessageCount: this.userMessageCount,
        };
      }

      if ('patterns' in arg || Array.isArray(arg)) {
        this.events.push('blocking-error');
        return this.blockingError;
      }

      if ('messageSelectors' in arg) {
        this.events.push('assistant-read');
        return this.newAssistantText;
      }

      if ('selectors' in arg) {
        this.events.push('generation-control');
        return this.generationActive;
      }

      if ('assistantMessageSelectors' in arg) {
        this.events.push('diagnostics');
        return {
          assistantMessageCount: this.newAssistantText
            ? this.assistantCountBeforeSubmit + 1
            : this.assistantCountBeforeSubmit,
          blockingError: this.blockingError || 'none',
          composerTextLength: this.composerText.trim().length,
          userMessageCount: this.userMessageCount,
        };
      }
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

  on(eventName: string, listener: (response: Response) => void): this {
    if (eventName === 'response') {
      this.responseListeners.push(listener);
    }
    return this;
  }

  off(eventName: string, listener: (response: Response) => void): this {
    if (eventName === 'response') {
      this.responseListeners = this.responseListeners.filter((candidate) => candidate !== listener);
    }
    return this;
  }

  isClosed(): boolean {
    return this.closed;
  }

  async close(): Promise<void> {
    this.events.push('close');
    this.closed = true;
  }

  asPage(): Page {
    return this as unknown as Page;
  }

  private handleModeAction(arg: { action?: unknown; preferredModes?: unknown }) {
    const preferredModes = Array.isArray(arg.preferredModes)
      ? (arg.preferredModes.filter(
          (mode): mode is PrettifyReasoning => mode === 'instant' || mode === 'standard' || mode === 'extended',
        ) as PrettifyReasoning[])
      : ['instant'];

    if (arg.action === 'read-current-mode') {
      this.events.push(`mode-read:${this.currentModeLabel}`);
      const mode = this.classifyModeLabel(this.currentModeLabel);
      if (mode !== 'unsafe' && mode && preferredModes.includes(mode)) {
        return {
          success: true,
          applied: mode,
          fallbackReason: mode === preferredModes[0] ? '' : 'current safe fallback mode',
        };
      }
      return {
        success: false,
        error: mode === 'unsafe' ? 'Current ChatGPT text mode appears unsafe for quick prettify' : undefined,
      };
    }

    if (arg.action === 'open-mode-menu') {
      this.events.push('mode-menu-open');
      if (!this.modeButtonAvailable) {
        return false;
      }
      this.modeMenuOpen = true;
      return true;
    }

    if (arg.action === 'select-mode') {
      if (!this.modeMenuOpen) {
        return { success: false, error: 'mode menu is closed' };
      }

      for (const preferredMode of preferredModes) {
        const label = this.modeOptions.find((option) => this.classifyModeLabel(option) === preferredMode);
        if (!label) continue;

        this.currentModeLabel = label;
        this.modeMenuOpen = false;
        this.events.push(`mode-select:${preferredMode}:${label}`);
        return {
          success: true,
          applied: preferredMode,
          fallbackReason: preferredMode === preferredModes[0] ? '' : 'requested mode unavailable',
        };
      }

      this.events.push('mode-select-failed');
      return {
        success: false,
        error: 'Only unsafe ChatGPT text modes were available for prettify',
      };
    }

    return undefined;
  }

  private classifyModeLabel(label: string): PrettifyReasoning | 'unsafe' | '' {
    const normalized = label.toLowerCase();
    if (/\b(pro|deep\s*research|research|agent|operator|codex)\b/.test(normalized)) return 'unsafe';
    if (!/\b(auto|fast|default|quick|gpt|4o|o[1-9]|think|thinking|reason|model)\b/.test(normalized)) {
      return '';
    }
    if (/\b(think|thinking|reason)\b/.test(normalized)) {
      if (/\b(extended|longer|more|advanced|max)\b/.test(normalized)) return 'extended';
      return 'standard';
    }
    return 'instant';
  }

  private submitPrompt(): void {
    if (this.firstSendDoesNotSubmit && this.sendClickCount === 1) {
      return;
    }
    if (this.urlValue === CHATGPT_URL) {
      this.urlValue = `${CHATGPT_URL}/c/${NEW_CONVERSATION_ID}`;
    }
    this.composerText = '';
    this.userMessageCount += 1;
    if (this.blockingErrorAfterSubmit) {
      this.blockingError = this.blockingErrorAfterSubmit;
    }
    this.emitConversationResponse(this.conversationResponseStatus);
  }

  private emitConversationResponse(status: number): void {
    const response = {
      status: () => status,
      url: () => `${CHATGPT_URL}/backend-api/f/conversation`,
    } as Response;
    for (const listener of this.responseListeners) {
      listener(response);
    }
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

async function withAdvancingResponseClock<T>(page: FakeChatGptPage, action: () => Promise<T>): Promise<T> {
  const originalNow = Date.now;
  const originalWaitForTimeout = page.waitForTimeout.bind(page);
  let now = 1000;
  Date.now = () => now;
  page.waitForTimeout = async (delayMs: number) => {
    page.events.push(`timeout:${delayMs}`);
    now += delayMs;
  };

  try {
    return await action();
  } finally {
    Date.now = originalNow;
    page.waitForTimeout = originalWaitForTimeout;
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
      assert.ok(textPage.events.indexOf('send-click') < textPage.events.indexOf('assistant-read'));
    } finally {
      Date.now = originalNow;
    }
  });

  it('rejects ChatGPT text prompts when the text page auth preflight has no access token', async () => {
    const provider = new ChatGPTVoiceProvider();
    const textPage = new FakeChatGptPage();
    textPage.authSessionHasAccessToken = false;
    const context = new FakeBrowserContext(textPage.asPage());
    const providerInternals = internals(provider);
    providerInternals.context = context.asContext();
    providerInternals.page = new FakeChatGptPage().asPage();

    await assert.rejects(providerInternals.sendChatGptTextPrompt('prompt'), /No access token/);

    assert.equal(textPage.events.includes('insert:prompt'), false);
  });

  it('selects the configured ChatGPT mode before inserting and sending the prompt', async () => {
    const provider = new ChatGPTVoiceProvider();
    const textPage = new FakeChatGptPage();
    textPage.currentModeLabel = 'Pro';
    textPage.modeOptions = ['Fast', 'Thinking', 'Pro'];
    const context = new FakeBrowserContext(textPage.asPage());
    const providerInternals = internals(provider);
    providerInternals.context = context.asContext();
    providerInternals.page = new FakeChatGptPage().asPage();

    const result = await withAdvancingResponseClock(textPage, () =>
      providerInternals.sendChatGptTextPrompt('prompt', 'instant'),
    );

    assert.equal(result, 'new answer');
    assert.equal(textPage.currentModeLabel, 'Fast');
    assert.ok(textPage.events.indexOf('mode-read:Pro') < textPage.events.indexOf('mode-menu-open'));
    assert.ok(textPage.events.indexOf('mode-menu-open') < textPage.events.indexOf('mode-select:instant:Fast'));
    assert.ok(textPage.events.indexOf('mode-select:instant:Fast') < textPage.events.indexOf('insert:prompt'));
    assert.ok(textPage.events.indexOf('insert:prompt') < textPage.events.indexOf('send-click'));
  });

  it('selects standard non-Pro reasoning when Standard is configured', async () => {
    const provider = new ChatGPTVoiceProvider();
    const textPage = new FakeChatGptPage();
    textPage.currentModeLabel = 'Pro';
    textPage.modeOptions = ['Fast', 'Thinking', 'Pro'];
    const context = new FakeBrowserContext(textPage.asPage());
    const providerInternals = internals(provider);
    providerInternals.context = context.asContext();
    providerInternals.page = new FakeChatGptPage().asPage();

    await withAdvancingResponseClock(textPage, () => providerInternals.sendChatGptTextPrompt('prompt', 'standard'));

    assert.equal(textPage.currentModeLabel, 'Thinking');
    assert.ok(textPage.events.includes('mode-select:standard:Thinking'));
  });

  it('prefers extended non-Pro reasoning and falls back to standard when extended is unavailable', async () => {
    const extendedProvider = new ChatGPTVoiceProvider();
    const extendedPage = new FakeChatGptPage();
    extendedPage.currentModeLabel = 'Pro';
    extendedPage.modeOptions = ['Fast', 'Thinking', 'Thinking longer', 'Pro'];
    const extendedInternals = internals(extendedProvider);
    extendedInternals.context = new FakeBrowserContext(extendedPage.asPage()).asContext();
    extendedInternals.page = new FakeChatGptPage().asPage();

    await withAdvancingResponseClock(extendedPage, () => extendedInternals.sendChatGptTextPrompt('prompt', 'extended'));

    assert.equal(extendedPage.currentModeLabel, 'Thinking longer');
    assert.ok(extendedPage.events.includes('mode-select:extended:Thinking longer'));

    const fallbackProvider = new ChatGPTVoiceProvider();
    const fallbackPage = new FakeChatGptPage();
    fallbackPage.currentModeLabel = 'Pro';
    fallbackPage.modeOptions = ['Fast', 'Thinking', 'Pro'];
    const fallbackInternals = internals(fallbackProvider);
    fallbackInternals.context = new FakeBrowserContext(fallbackPage.asPage()).asContext();
    fallbackInternals.page = new FakeChatGptPage().asPage();

    await withAdvancingResponseClock(fallbackPage, () => fallbackInternals.sendChatGptTextPrompt('prompt', 'extended'));

    assert.equal(fallbackPage.currentModeLabel, 'Thinking');
    assert.ok(fallbackPage.events.includes('mode-select:standard:Thinking'));
  });

  it('fails before inserting text when only unsafe ChatGPT modes are available', async () => {
    const provider = new ChatGPTVoiceProvider();
    const textPage = new FakeChatGptPage();
    textPage.currentModeLabel = 'Pro';
    textPage.modeOptions = ['Pro', 'Deep research'];
    const context = new FakeBrowserContext(textPage.asPage());
    const providerInternals = internals(provider);
    providerInternals.context = context.asContext();
    providerInternals.page = new FakeChatGptPage().asPage();

    await assert.rejects(
      providerInternals.sendChatGptTextPrompt('prompt', 'instant'),
      /unsafe ChatGPT text modes|safe ChatGPT reasoning mode/,
    );

    assert.equal(textPage.events.includes('insert:prompt'), false);
    assert.equal(textPage.events.includes('send-click'), false);
  });

  it('reuses an already open ChatGPT text conversation without navigating home', async () => {
    const provider = new ChatGPTVoiceProvider();
    const textPage = new FakeChatGptPage();
    textPage.urlValue = `${CHATGPT_URL}/c/${SAVED_CONVERSATION_ID}`;
    const providerInternals = internals(provider);
    providerInternals.textPage = textPage.asPage();
    providerInternals.page = new FakeChatGptPage().asPage();
    providerInternals.textChatConversationId = SAVED_CONVERSATION_ID;

    const result = await withAdvancingResponseClock(textPage, () =>
      providerInternals.sendChatGptTextPrompt('prompt', 'instant'),
    );

    assert.equal(result, 'new answer');
    assert.deepEqual(
      textPage.events.filter((event) => event.startsWith('goto:')),
      [],
    );
    assert.equal(textPage.url(), `${CHATGPT_URL}/c/${SAVED_CONVERSATION_ID}`);
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

  it('creates one replacement chat when the saved conversation redirects away and saves the replacement id', async () => {
    const provider = new ChatGPTVoiceProvider();
    const textPage = new FakeChatGptPage();
    textPage.redirectSavedConversationToHome = true;
    const context = new FakeBrowserContext(textPage.asPage());
    const providerInternals = internals(provider);
    providerInternals.context = context.asContext();
    providerInternals.page = new FakeChatGptPage().asPage();
    providerInternals.textChatConversationId = SAVED_CONVERSATION_ID;
    let savedUrl = '';
    providerInternals.saveCurrentTextChatConversationId = (page: Page) => {
      savedUrl = page.url();
      providerInternals.textChatConversationId = NEW_CONVERSATION_ID;
    };

    const result = await withAdvancingResponseClock(textPage, () =>
      providerInternals.sendChatGptTextPrompt('prompt', 'instant'),
    );

    assert.equal(result, 'new answer');
    assert.deepEqual(
      textPage.events.filter((event) => event.startsWith('goto:')),
      [`goto:${CHATGPT_URL}/c/${SAVED_CONVERSATION_ID}`, `goto:${CHATGPT_URL}`],
    );
    assert.equal(savedUrl, `${CHATGPT_URL}/c/${NEW_CONVERSATION_ID}`);
    assert.equal(providerInternals.textChatConversationId, NEW_CONVERSATION_ID);
  });

  it('continues using a saved conversation id when history hydration is slow', async () => {
    const provider = new ChatGPTVoiceProvider();
    const page = new FakeChatGptPage();
    page.historyHydrates = false;
    const providerInternals = internals(provider);
    providerInternals.textChatConversationId = SAVED_CONVERSATION_ID;

    await providerInternals.openReusableChatGptComposer(page.asPage());

    assert.equal(providerInternals.textChatConversationId, SAVED_CONVERSATION_ID);
    assert.deepEqual(
      page.events.filter((event) => event.startsWith('goto:')),
      [`goto:${CHATGPT_URL}/c/${SAVED_CONVERSATION_ID}`],
    );
  });

  it('saves the current conversation id even when response waiting fails', async () => {
    const originalNow = Date.now;
    let now = 1000;
    Date.now = () => now;

    try {
      const provider = new ChatGPTVoiceProvider();
      const textPage = new FakeChatGptPage();
      textPage.newAssistantText = '';
      const context = new FakeBrowserContext(textPage.asPage());
      const providerInternals = internals(provider);
      providerInternals.context = context.asContext();
      let savedUrl = '';
      providerInternals.saveCurrentTextChatConversationId = (page: Page) => {
        savedUrl = page.url();
      };
      textPage.waitForTimeout = async (delayMs: number) => {
        textPage.events.push(`timeout:${delayMs}`);
        now += delayMs;
      };

      await assert.rejects(providerInternals.sendChatGptTextPrompt('prompt'), /Timed out waiting for ChatGPT response/);

      assert.equal(savedUrl, `${CHATGPT_URL}/c/${NEW_CONVERSATION_ID}`);
    } finally {
      Date.now = originalNow;
    }
  });

  it('retries the send click once when the prompt remains in the composer', async () => {
    const originalNow = Date.now;
    let now = 1000;
    Date.now = () => now;

    try {
      const provider = new ChatGPTVoiceProvider();
      const textPage = new FakeChatGptPage();
      textPage.firstSendDoesNotSubmit = true;
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
      assert.equal(textPage.events.filter((event) => event === 'send-click').length, 2);
    } finally {
      Date.now = originalNow;
    }
  });

  it('fails quickly when ChatGPT shows a blocking challenge after submit', async () => {
    const provider = new ChatGPTVoiceProvider();
    const textPage = new FakeChatGptPage();
    textPage.blockingErrorAfterSubmit = 'unusual activity';
    const context = new FakeBrowserContext(textPage.asPage());
    const providerInternals = internals(provider);
    providerInternals.context = context.asContext();

    await assert.rejects(providerInternals.sendChatGptTextPrompt('prompt'), /unusual activity/);
  });

  it('fails quickly when the ChatGPT conversation request returns a non-OK response', async () => {
    const provider = new ChatGPTVoiceProvider();
    const textPage = new FakeChatGptPage();
    textPage.conversationResponseStatus = 429;
    const context = new FakeBrowserContext(textPage.asPage());
    const providerInternals = internals(provider);
    providerInternals.context = context.asContext();

    await assert.rejects(providerInternals.sendChatGptTextPrompt('prompt'), /f\/conversation 429/);
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
      assert.equal(textPage.events.includes('send-click'), false);
      assert.ok(textPage.events.includes('press:Enter'));
      assert.equal(textPage.url(), `${CHATGPT_URL}/c/${NEW_CONVERSATION_ID}`);
    } finally {
      Date.now = originalNow;
    }
  });

  it('returns a cancelled result and closes the text page when a prettify signal aborts', async () => {
    const originalNow = Date.now;
    let now = 1000;
    Date.now = () => now;

    try {
      const provider = new ChatGPTVoiceProvider();
      const textPage = new FakeChatGptPage();
      textPage.newAssistantText = '';
      const transcriptionPage = new FakeChatGptPage();
      const context = new FakeBrowserContext(textPage.asPage());
      const providerInternals = internals(provider);
      const abortController = new AbortController();
      providerInternals.accessToken = 'token';
      providerInternals.context = context.asContext();
      providerInternals.page = transcriptionPage.asPage();
      textPage.waitForTimeout = async (delayMs: number) => {
        textPage.events.push(`timeout:${delayMs}`);
        now += delayMs;
        if (delayMs === 300 && !abortController.signal.aborted) {
          abortController.abort();
        }
      };

      const result = await provider.prettifyText('selected text', {
        prompt: 'Improve text',
        reasoning: 'instant',
        signal: abortController.signal,
      });

      assert.deepEqual(result, { success: false, error: 'Prettify cancelled' });
      assert.equal(textPage.closed, true);
      assert.equal(providerInternals.textPage, null);
      assert.equal(transcriptionPage.closed, false);
    } finally {
      Date.now = originalNow;
    }
  });
});
