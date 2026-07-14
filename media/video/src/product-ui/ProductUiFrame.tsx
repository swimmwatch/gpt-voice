import type { CSSProperties, JSX } from 'react';
import type { OllamaModelControl } from '@renderer/prettifyModelControl';
import type { ProviderAuthType, ProviderInfo, ProviderSettings } from '@renderer/types';
import type { RecordingLifecycleState } from '@shared/recordingLifecycle';
import {
  MainToolbar,
  PrettifyModelMemoryRow,
  ProviderSettingsModalView,
  RecordingControls,
  TooltipProvider,
  TranslateSection,
} from './productImports';
import './product-ui.css';

const PRODUCT_UI_WIDTH = 460;
const PRODUCT_UI_HEIGHT = 420;

type ProductUiFrameStyle = CSSProperties & Record<'--video-spinner-rotation', string>;

const providers: readonly ProviderInfo[] = [
  { authType: 'browserSession', id: 'chatgpt', name: 'ChatGPT Web' },
  { authType: 'apiKey', id: 'openai-api', name: 'OpenAI API' },
];

const savedChatGptSession: ProviderSettings = {
  authType: 'browserSession',
  hasSession: true,
  providerId: 'chatgpt',
};

const inertCallback = (): void => undefined;

export interface ProductUiFrameState {
  activeProviderId: 'chatgpt' | 'openai-api';
  connection: 'connected' | 'setup-required';
  lifecycle: RecordingLifecycleState;
  modelControl: OllamaModelControl;
  providerModal: 'chatgpt-session-saved' | 'closed';
  statusDetail: string;
  targetLang: 'be' | 'en' | 'ru' | 'uk';
}

export interface ProductUiFrameProps {
  scale?: number;
  spinnerRotation: number;
  state: ProductUiFrameState;
}

/** Temporary Task 8 preview state; Task 9 replaces this with the complete validated fixture module. */
export const productUiFramePreviewState: ProductUiFrameState = {
  activeProviderId: 'chatgpt',
  connection: 'connected',
  lifecycle: 'idle',
  modelControl: {
    isLoaded: true,
    model: 'llama3.2:3b-instruct-q4_K_M',
    vramSizeBytes: 2_147_483_648,
  },
  providerModal: 'closed',
  statusDetail: '',
  targetLang: 'ru',
};

function getActiveProvider(providerId: ProductUiFrameState['activeProviderId']): ProviderInfo {
  return providers.find((provider) => provider.id === providerId) ?? providers[0];
}

/** Renders the canonical Command Dock at its native geometry with deterministic video-only interaction behavior. */
export function ProductUiFrame({ scale = 1, spinnerRotation, state }: ProductUiFrameProps): JSX.Element {
  const activeProvider = getActiveProvider(state.activeProviderId);
  const activeProviderAuthType: ProviderAuthType = activeProvider.authType;
  const isLoggedIn = state.connection === 'connected';
  const frameStyle = {
    '--video-spinner-rotation': `${spinnerRotation}deg`,
    height: PRODUCT_UI_HEIGHT,
    scale,
    transformOrigin: 'top left',
    width: PRODUCT_UI_WIDTH,
  } satisfies ProductUiFrameStyle;

  return (
    <div
      className="product-ui-frame-viewport"
      data-slot="product-ui-frame"
      style={{ height: PRODUCT_UI_HEIGHT * scale, width: PRODUCT_UI_WIDTH * scale }}
    >
      <div className="product-ui-frame" style={frameStyle}>
        <TooltipProvider>
          <div className="command-dock">
            <MainToolbar
              activeProviderAuthType={activeProviderAuthType}
              activeProviderId={activeProvider.id}
              activeProviderName={activeProvider.name}
              isLoggedIn={isLoggedIn}
              isLoggingIn={false}
              onOpenAbout={inertCallback}
              onOpenAppSettings={inertCallback}
              onOpenHistory={inertCallback}
              onOpenProviderSettings={inertCallback}
              onProviderChange={inertCallback}
              onProviderLogin={inertCallback}
              providers={[...providers]}
            />
            <PrettifyModelMemoryRow control={state.modelControl} error="" isRunning={false} onAction={inertCallback} />
            <RecordingControls
              onCancel={inertCallback}
              onPause={inertCallback}
              onResume={inertCallback}
              onStart={inertCallback}
              onStop={inertCallback}
              recordHotkey="F9"
              state={state.lifecycle}
              status={state.statusDetail}
            />
            <TranslateSection onLangChange={inertCallback} targetLang={state.targetLang} />
          </div>

          {state.providerModal === 'chatgpt-session-saved' && (
            <ProviderSettingsModalView
              apiKey=""
              error=""
              isClearConfirmationOpen={false}
              isSaving={false}
              language="auto"
              onApiKeyChange={inertCallback}
              onClearAuthentication={inertCallback}
              onClearConfirmationOpenChange={inertCallback}
              onClose={inertCallback}
              onLanguageChange={inertCallback}
              onLogin={inertCallback}
              onPromptChange={inertCallback}
              onSaveOpenAIApiSettings={inertCallback}
              onTemperatureChange={inertCallback}
              prompt=""
              provider={providers[0]}
              settings={savedChatGptSession}
              temperature={0}
            />
          )}
        </TooltipProvider>
      </div>
    </div>
  );
}
