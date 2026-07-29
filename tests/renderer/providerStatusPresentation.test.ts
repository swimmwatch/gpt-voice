import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nService } from '@main/i18n';
import { ProviderStatusIndicator, getProviderStatusAccessibleName } from '@renderer/components/ProviderStatusIndicator';
import { getTranslationProviderConnectionPresentation } from '@renderer/components/TranslateSection';
import { VOICE_PROVIDER_CONNECTION_TOOLTIP_KEYS } from '@renderer/components/MainToolbar';
import { TooltipProvider } from '@renderer/components/ui/tooltip';
import {
  MAIN_PRETTIFY_HTTP_CONNECTION_STATUSES,
  getMainPrettifyProviderViewState,
} from '@renderer/mainPrettifyProvider';
import { PROVIDER_CONNECTION_REASONS } from '@renderer/providerState';
import { createBrowserProviderFailurePresentation, renderRendererStatus } from '@renderer/statusPresentation';
import { presentNotificationError } from '@shared/notifications';
import { APP_LOCALE_IDS } from '@shared/appLocale';
import { DEFAULT_PRETTIFY_SETTINGS } from '@shared/prettifySettings';
import {
  DEFAULT_TRANSLATION_SETTINGS,
  TRANSLATION_PROVIDER_CONNECTION_DETAILS,
  TRANSLATION_PROVIDER_CONNECTION_STATUSES,
} from '@shared/translationProvider';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const PRIVATE_FAILURE_CANARY = 'https://private.example.test/account/private-session-canary';

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

describe('provider status presentation', () => {
  it('deduplicates equal accessible status text while preserving distinct explanations in order', () => {
    assert.equal(getProviderStatusAccessibleName(' Connected ', 'Connected'), 'Connected');
    assert.equal(
      getProviderStatusAccessibleName('Not connected', 'The browser is unavailable'),
      'Not connected. The browser is unavailable',
    );

    const equalMarkup = renderToStaticMarkup(
      createElement(
        TooltipProvider,
        null,
        createElement(ProviderStatusIndicator, {
          dataSlot: 'equal-status',
          label: 'Connected',
          tone: 'success',
          tooltip: 'Connected',
        }),
      ),
    );
    const distinctMarkup = renderToStaticMarkup(
      createElement(
        TooltipProvider,
        null,
        createElement(ProviderStatusIndicator, {
          dataSlot: 'distinct-status',
          label: 'Not connected',
          tone: 'error',
          tooltip: 'The browser is unavailable',
        }),
      ),
    );

    assert.match(equalMarkup, /aria-label="Connected"/u);
    assert.doesNotMatch(equalMarkup, /aria-label="Connected\. Connected"/u);
    assert.match(distinctMarkup, /aria-label="Not connected\. The browser is unavailable"/u);
    assert.match(distinctMarkup, /role="status"/u);
    assert.match(distinctMarkup, /tabindex="0"/u);
  });

  it('uses one sanitized browser failure descriptor for Voice status and tooltip state', () => {
    const localization = new I18nService('ru');
    const failure = createBrowserProviderFailurePresentation(new Error(PRIVATE_FAILURE_CANARY));
    const localizedStatus = renderRendererStatus(failure.status, localization.translate);

    assert.equal(failure.reason, PROVIDER_CONNECTION_REASONS.BrowserUnavailable);
    assert.equal(Boolean(localizedStatus.trim()), true);
    assert.doesNotMatch(localizedStatus, /private-session-canary|private\.example|https?:\/\//u);

    const app = readProjectFile('src/renderer/App.tsx');
    const failureHandler = app.slice(
      app.indexOf('const applyBrowserProviderFailure'),
      app.indexOf('const refreshPrettifyProviderState'),
    );
    const selectionHandler = app.slice(
      app.indexOf('const handleProviderSelectionEvent'),
      app.indexOf('useEffect(() =>', app.indexOf('const handleProviderSelectionEvent')),
    );
    const settledCase = selectionHandler.slice(selectionHandler.indexOf("case 'switch-settled'"));

    assert.match(failureHandler, /setIsLoggedIn\(false\)/u);
    assert.match(failureHandler, /setProviderConnectionReason\(failure\.reason\)/u);
    assert.match(failureHandler, /setProviderConnectionFailureStatus\(failure\.status\)/u);
    assert.match(failureHandler, /setStatusAndNotify\(failure\.status\)/u);
    assert.match(selectionHandler, /case 'bootstrap-failed'[\s\S]*?applyBrowserProviderFailure\(event\.error\)/u);
    assert.match(
      selectionHandler,
      /case 'switch-completed'[\s\S]*?if \(!event\.result\.success\)[\s\S]*?applyBrowserProviderFailure\(event\.result\.error\)/u,
    );
    assert.match(selectionHandler, /case 'switch-failed'[\s\S]*?applyBrowserProviderFailure\(event\.error\)/u);
    assert.doesNotMatch(settledCase, /setProviderConnectionReason|setProviderConnectionFailureStatus/u);
  });

  it('localizes every closed Voice and Translation connection explanation', () => {
    const localization = new I18nService();
    const translationSettings = DEFAULT_TRANSLATION_SETTINGS;
    const targetLanguage = translationSettings.targetLanguageByProvider[translationSettings.providerId];

    for (const locale of APP_LOCALE_IDS) {
      localization.setLocale(locale);
      for (const [reason, key] of Object.entries(VOICE_PROVIDER_CONNECTION_TOOLTIP_KEYS)) {
        const message = localization.translate(key, { provider: 'ChatGPT' });
        assert.equal(Boolean(message.trim()), true, `${locale}:voice:${reason}`);
        assert.notEqual(message, key, `${locale}:voice:${reason}`);
      }

      for (const detail of Object.values(TRANSLATION_PROVIDER_CONNECTION_DETAILS)) {
        const presentation = getTranslationProviderConnectionPresentation(
          {
            detail,
            providerId: translationSettings.providerId,
            status:
              detail === TRANSLATION_PROVIDER_CONNECTION_DETAILS.Ready
                ? TRANSLATION_PROVIDER_CONNECTION_STATUSES.Connected
                : TRANSLATION_PROVIDER_CONNECTION_STATUSES.NotConnected,
            targetLanguage,
          },
          translationSettings,
        );
        const label = localization.translate(presentation.labelKey);
        const tooltip = localization.translate(presentation.tooltipKey);
        assert.equal(Boolean(label.trim()), true, `${locale}:translation:${detail}:label`);
        assert.equal(Boolean(tooltip.trim()), true, `${locale}:translation:${detail}:tooltip`);
        assert.notEqual(label, presentation.labelKey, `${locale}:translation:${detail}:label`);
        assert.notEqual(tooltip, presentation.tooltipKey, `${locale}:translation:${detail}:tooltip`);
      }
    }
  });

  it('uses the active locale for bounded Prettify HTTP failures and CLI status explanations', () => {
    const localization = new I18nService('de');
    const localizedTimeout = presentNotificationError(new Error('Operation timed out'), {
      context: 'generic',
      t: localization.translate,
    }).userMessage;
    const english = new I18nService('en');
    const englishTimeout = presentNotificationError(new Error('Operation timed out'), {
      context: 'generic',
      t: english.translate,
    }).userMessage;
    const cliFailure = getMainPrettifyProviderViewState(
      { ...DEFAULT_PRETTIFY_SETTINGS, providerId: 'claude-cli' },
      [],
      {
        errorCode: 'timed-out',
        providerId: 'claude-cli',
        status: 'unavailable',
      },
    ).connection;
    const httpFailure = getMainPrettifyProviderViewState(
      { ...DEFAULT_PRETTIFY_SETTINGS, providerId: 'vllm' },
      [],
      null,
      {
        providerId: 'vllm',
        status: MAIN_PRETTIFY_HTTP_CONNECTION_STATUSES.NotConnected,
      },
    ).connection;

    assert.notEqual(localizedTimeout, englishTimeout);
    assert.equal(Boolean(cliFailure?.tooltipKey), true);
    assert.equal(Boolean(httpFailure?.tooltipKey), true);
    assert.notEqual(
      localization.translate(cliFailure?.tooltipKey ?? 'error.notificationUnknown'),
      cliFailure?.tooltipKey,
    );
    assert.notEqual(
      localization.translate(httpFailure?.tooltipKey ?? 'error.notificationUnknown'),
      httpFailure?.tooltipKey,
    );

    const app = readProjectFile('src/renderer/App.tsx');
    assert.match(app, /presentNotificationError\(result\.error, \{\s*context: 'generic',\s*t,\s*\}\)\.userMessage/u);
  });
});
