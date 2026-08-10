import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nService } from '@main/i18n';
import { ProviderStatusIndicator, getProviderStatusAccessibleName } from '@renderer/components/ProviderStatusIndicator';
import { ProgressSpinner } from '@renderer/components/ui/spinner';
import { getTranslationProviderConnectionPresentation } from '@renderer/components/TranslateSection';
import { getProviderActionLabelKey, VOICE_PROVIDER_CONNECTION_TOOLTIP_KEYS } from '@renderer/components/MainToolbar';
import { TooltipProvider } from '@renderer/components/ui/tooltip';
import {
  MAIN_PRETTIFY_HTTP_CONNECTION_STATUSES,
  getMainPrettifyProviderViewState,
} from '@renderer/mainPrettifyProvider';
import { PROVIDER_CONNECTION_REASONS } from '@renderer/providerState';
import {
  clearRecoveredBrowserFailureStatus,
  createBrowserProviderFailurePresentation,
  renderRendererStatus,
  translatedStatus,
} from '@renderer/statusPresentation';
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
  it('offers re-login only for an expired browser session', () => {
    assert.equal(
      getProviderActionLabelKey('browserSession', PROVIDER_CONNECTION_REASONS.SessionExpired),
      'providerSettings.relogin',
    );
    assert.equal(
      getProviderActionLabelKey('browserSession', PROVIDER_CONNECTION_REASONS.BrowserUnavailable),
      'provider.connect',
    );
    assert.equal(getProviderActionLabelKey('apiKey', PROVIDER_CONNECTION_REASONS.SessionExpired), 'provider.configure');
  });

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
    assert.match(equalMarkup, /border-0/u);
    assert.match(equalMarkup, /bg-transparent/u);
    assert.match(equalMarkup, /provider-status-badge/u);
    assert.match(equalMarkup, /lucide-circle-check/u);
    assert.doesNotMatch(equalMarkup, />Connected</u);
    assert.match(distinctMarkup, /aria-label="Not connected\. The browser is unavailable"/u);
    assert.match(distinctMarkup, /border-0/u);
    assert.match(distinctMarkup, /bg-transparent/u);
    assert.match(distinctMarkup, /provider-status-badge/u);
    assert.match(distinctMarkup, /lucide-circle-off/u);
    assert.doesNotMatch(distinctMarkup, />Not connected</u);
    assert.match(distinctMarkup, /role="status"/u);
    assert.match(distinctMarkup, /tabindex="0"/u);
  });

  it('uses a fixed icon-only badge and preserves localized indeterminate loading feedback', () => {
    const loadingMarkup = renderToStaticMarkup(
      createElement(
        TooltipProvider,
        null,
        createElement(ProviderStatusIndicator, {
          dataSlot: 'loading-status',
          label: 'Checking connection',
          loading: true,
          tone: 'neutral',
          tooltip: 'Opening provider',
        }),
      ),
    );

    assert.match(loadingMarkup, /provider-status-badge/u);
    assert.match(loadingMarkup, /data-progress-state="indeterminate"/u);
    assert.match(loadingMarkup, /lucide-loader-circle/u);
    assert.match(loadingMarkup, /animate-spin/u);
    assert.doesNotMatch(loadingMarkup, /stroke-dasharray=/u);
    assert.match(loadingMarkup, /aria-label="Checking connection\. Opening provider"/u);
    assert.doesNotMatch(loadingMarkup, />Checking connection</u);
  });

  it('does not estimate operation completion from elapsed time', () => {
    const spinner = readProjectFile('src/renderer/components/ui/spinner.tsx');

    assert.match(spinner, /data-progress-state=\{tracksOperation \? 'indeterminate' : undefined\}/u);
    assert.doesNotMatch(spinner, /requestAnimationFrame|performance\.now|Math\.exp|setTimeout/u);
  });

  it('forces a checking presentation while the Translation provider is changing', () => {
    const settings = DEFAULT_TRANSLATION_SETTINGS;
    const presentation = getTranslationProviderConnectionPresentation(
      {
        detail: TRANSLATION_PROVIDER_CONNECTION_DETAILS.Ready,
        providerId: settings.providerId,
        status: TRANSLATION_PROVIDER_CONNECTION_STATUSES.Connected,
        targetLanguage: settings.targetLanguageByProvider[settings.providerId],
      },
      settings,
      true,
    );

    assert.deepEqual(presentation, {
      labelKey: 'provider.connectionChecking',
      loading: true,
      tone: 'neutral',
      tooltipKey: 'provider.connectionCheckingTooltip',
    });

    const stalePresentation = getTranslationProviderConnectionPresentation(
      {
        detail: TRANSLATION_PROVIDER_CONNECTION_DETAILS.Ready,
        providerId: settings.providerId,
        status: TRANSLATION_PROVIDER_CONNECTION_STATUSES.Connected,
        targetLanguage: 'stale-target-language',
      },
      settings,
    );
    assert.equal(stalePresentation.loading, true);
    assert.equal(stalePresentation.labelKey, 'provider.connectionChecking');
  });

  it('keeps reference navigation available while locking every main-window configuration control during active work', () => {
    const app = readProjectFile('src/renderer/App.tsx');
    const toolbar = readProjectFile('src/renderer/components/MainToolbar.tsx');
    const prettify = readProjectFile('src/renderer/components/MainPrettifyProviderBand.tsx');
    const translation = readProjectFile('src/renderer/components/TranslateSection.tsx');
    const styles = readProjectFile('src/renderer/styles/globals.css');
    const aboutAction = toolbar.slice(
      toolbar.indexOf("aria-label={t('navigation.openAbout')"),
      toolbar.indexOf("aria-label={t('navigation.openHistory')"),
    );
    const historyAction = toolbar.slice(
      toolbar.indexOf("aria-label={t('navigation.openHistory')"),
      toolbar.indexOf("aria-label={t('navigation.openAppSettings')"),
    );

    assert.match(
      app,
      /const isProviderChangesLocked =\s*isVoiceProviderSwitching \|\|\s*isPrettifyProviderSwitching \|\|\s*isTranslationProviderSwitching \|\|\s*isRecordingLifecycleBusy\(recordingState\) \|\|\s*isPrettifyModelActionRunning \|\|\s*activeTextAction !== null;/u,
    );
    assert.match(
      app,
      /const \[activeTextAction, setActiveTextAction\] = useState<TextActionStatusAction \| null>\(null\);/u,
    );
    assert.match(
      app,
      /onTranslationStatus\(\(nextStatus\) => \{[\s\S]*?if \(nextStatus\.phase === 'working'\) return nextStatus\.action;[\s\S]*?current === nextStatus\.action \? null : current/u,
    );
    assert.match(app, /case 'switch-started':[\s\S]*setIsVoiceProviderSwitching\(true\)/u);
    assert.match(app, /case 'switch-settled':[\s\S]*setIsVoiceProviderSwitching\(false\)/u);
    assert.match(app, /isProviderChangesLocked=\{isProviderChangesLocked\}/u);
    assert.match(app, /isVoiceProviderSwitching=\{isVoiceProviderSwitching\}/u);
    assert.match(
      app,
      /const openProviderSettings[\s\S]*?if \(isProviderChangesLocked \|\| isRecordingLifecycleBusy\(recordingStateRef\.current\)\) return;/u,
    );
    assert.match(
      app,
      /const handleLogin[\s\S]*?isProviderChangesLocked \|\|[\s\S]*?isRecordingLifecycleBusy\(recordingStateRef\.current\)/u,
    );
    assert.match(app, /if \(isProviderChangesLocked\) return;/u);

    assert.match(toolbar, /<Select\s+disabled=\{isProviderChangesLocked\}/u);
    assert.equal((toolbar.match(/disabled=\{isProviderChangesLocked\}/gu) ?? []).length >= 4, true);
    assert.doesNotMatch(aboutAction, /disabled=/u);
    assert.doesNotMatch(historyAction, /disabled=/u);
    assert.match(toolbar, /onClick=\{\(\) => \{\s*if \(isProviderChangesLocked\) return;\s*onOpenAppSettings\(\);/u);
    assert.match(
      toolbar,
      /onValueChange=\{\(providerId\) => \{\s*if \(isProviderChangesLocked\) return;\s*onProviderChange\(providerId\);/u,
    );
    assert.match(toolbar, /if \(isLoggingIn \|\| isProviderChangesLocked\) return;\s*onProviderLogin\(\);/u);
    assert.match(toolbar, /if \(isProviderChangesLocked\) return;\s*onOpenProviderSettings\(\);/u);
    assert.match(
      styles,
      /\.command-dock \.command-dock-settings-shortcut:not\(:disabled\) \{[\s\S]*?cursor: pointer;/u,
    );
    assert.match(styles, /\.command-dock \.command-dock-settings-shortcut:disabled \{[\s\S]*?cursor: not-allowed;/u);
    assert.match(styles, /\.command-dock \.command-dock-settings-shortcut:not\(:disabled\):hover \{/u);
    assert.match(
      toolbar,
      /isVoiceProviderSwitching \? \([\s\S]*?<ProviderStatusIndicator[\s\S]*?loading[\s\S]*?tone="neutral"/u,
    );
    assert.match(toolbar, /isVoiceProviderSwitching \? \([\s\S]*?: isLocalWhisperProvider \?/u);
    assert.match(prettify, /disabled=\{isProviderChangesLocked\}/u);
    assert.match(prettify, /disabled=\{isModelActionRunning \|\| isProviderChangesLocked\}/u);
    assert.match(prettify, /if \(isProviderChangesLocked\) return;\s*if \(isPrettifyProviderId\(providerId\)\)/u);
    assert.match(prettify, /if \(isModelActionRunning \|\| isProviderChangesLocked\) return;\s*onModelAction\(\);/u);
    assert.match(prettify, /if \(isProviderChangesLocked\) return;\s*onOpenSettings\(\);/u);
    assert.match(prettify, /getMainPrettifyProviderViewState\([\s\S]*?isProviderChangeSaving,/u);
    assert.equal((translation.match(/disabled=\{isSaving \|\| isProviderChangesLocked\}/gu) ?? []).length, 2);
    assert.equal((translation.match(/if \(isSaving \|\| isProviderChangesLocked\) return;/gu) ?? []).length, 2);
    assert.match(translation, /loading=\{connectionPresentation\.loading\}/u);
    assert.match(app, /onTargetLanguageChange=\{\(targetLanguage\) => \{\s*if \(isProviderChangesLocked\) return;/u);
    const translationSettingsSave = app.slice(
      app.indexOf('const saveTranslationSettings = async'),
      app.indexOf('if (!isI18nReady || firstLaunchStartupPresentation.isPending)'),
    );
    assert.match(
      translationSettingsSave,
      /translationSettingsRef\.current = candidate[\s\S]*?await desktopApi\.setTranslateSettings\(candidate\)[\s\S]*?const connectionRequestId = translationConnectionRequestRef\.current[\s\S]*?await desktopApi\.getTranslationProviderConnection\(\)[\s\S]*?connectionRequestId === translationConnectionRequestRef\.current[\s\S]*?translationSettingsSavePendingRef\.current = false/u,
    );
    assert.match(app, /doesTranslationConnectionMatchSettings\(connectionState, translationSettingsRef\.current\)/u);
    assert.match(app, /const isNewRecordingLocked =[\s\S]*activeTextAction !== null;/u);
    assert.match(app, /recordingDisabled=\{activeProviderId === null \|\| isNewRecordingLocked\}/u);
  });

  it('uses an icon-only disconnected-provider action for every authentication type', () => {
    const toolbar = readProjectFile('src/renderer/components/MainToolbar.tsx');

    assert.match(toolbar, /className="command-dock-provider-action"[\s\S]*?data-icon-only[\s\S]*?size="icon"/u);
    assert.doesNotMatch(toolbar, /isBrowserSessionProvider|<span>\{isLoggingIn \? t\('login\.loggingIn'\)/u);
  });

  it('renders a determinate circle only from a supplied measured percentage', () => {
    const markup = renderToStaticMarkup(createElement(ProgressSpinner, { label: 'Model download', progress: 42.4 }));

    assert.match(markup, /data-progress-state="determinate"/u);
    assert.match(markup, /role="progressbar"/u);
    assert.match(markup, /aria-valuenow="42"/u);
    assert.match(markup, /aria-valuetext="Model download: 42%"/u);
    assert.match(markup, /stroke-dasharray=/u);
    assert.doesNotMatch(markup, /lucide-loader-circle|animate-spin/u);
  });

  it('uses measured bytes only while an artifact is downloading', () => {
    const controls = readProjectFile('src/renderer/localWhisper/components/LocalWhisperArtifactControls.tsx');

    assert.match(controls, /progress\?\.state === 'Downloading' && progress\.totalBytes > 0/u);
    assert.match(
      controls,
      /<ProgressSpinner announce=\{false\} label=\{progressLabel\} progress=\{presentation\.percent\} size="sm"/u,
    );
    assert.match(controls, /<Spinner announce=\{false\} label=\{progressLabel\} size="sm"/u);
  });

  it('keeps Prettify status out of the model summary and surfaces errors through the connection indicator', () => {
    const providerBand = readProjectFile('src/renderer/components/MainPrettifyProviderBand.tsx');

    assert.doesNotMatch(providerBand, /dataSlot="prettify-provider-state"/u);
    assert.doesNotMatch(providerBand, /command-dock-prettify-state/u);
    assert.match(
      providerBand,
      /const providerConnectionTooltip = isProviderChangeSaving\s*\? t\('provider\.connectionCheckingTooltip'\)\s*:\s*error/u,
    );
    assert.match(providerBand, /dataSlot="prettify-provider-connection"/u);
  });

  it('keeps browser failures sanitized while restoring main-authoritative provider state', () => {
    const localization = new I18nService('ru');
    const failure = createBrowserProviderFailurePresentation(new Error(PRIVATE_FAILURE_CANARY));
    const localizedStatus = renderRendererStatus(failure.status, localization.translate);

    assert.equal(failure.reason, PROVIDER_CONNECTION_REASONS.BrowserUnavailable);
    assert.equal(Boolean(localizedStatus.trim()), true);
    assert.doesNotMatch(localizedStatus, /private-session-canary|private\.example|https?:\/\//u);
    assert.equal(clearRecoveredBrowserFailureStatus(failure.status), null);
    const activeRecordingStatus = translatedStatus('status.recording');
    assert.equal(clearRecoveredBrowserFailureStatus(activeRecordingStatus), activeRecordingStatus);

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
    const completedCase = selectionHandler.slice(
      selectionHandler.indexOf("case 'switch-completed'"),
      selectionHandler.indexOf("case 'switch-failed'"),
    );

    assert.match(failureHandler, /setIsLoggedIn\(false\)/u);
    assert.match(failureHandler, /setProviderConnectionReason\(failure\.reason\)/u);
    assert.match(failureHandler, /setProviderConnectionFailureStatus\(failure\.status\)/u);
    assert.match(failureHandler, /setStatusAndNotify\(failure\.status\)/u);
    assert.match(selectionHandler, /case 'bootstrap-failed'[\s\S]*?applyBrowserProviderFailure\(event\.error\)/u);
    assert.match(completedCase, /event\.result\.committedProviderId/u);
    assert.match(completedCase, /applyProviderLoginState\(committedAuthType/u);
    assert.doesNotMatch(completedCase, /applyBrowserProviderFailure/u);
    assert.match(selectionHandler, /case 'switch-failed'[\s\S]*?applyBrowserProviderFailure\(event\.error\)/u);
    assert.match(selectionHandler, /activeProviderAuthTypeRef\.current === 'localRuntime'/u);
    assert.doesNotMatch(settledCase, /setProviderConnectionReason|setProviderConnectionFailureStatus/u);
    assert.match(app, /onBgBrowserReady\([\s\S]*?setStatus\(clearRecoveredBrowserFailureStatus\)/u);
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
