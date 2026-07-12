import type { JSX } from 'react';
import type { EditableCloakBrowserSettings } from '@renderer/appSettingsUtils';
import type { FieldErrorRenderer, TranslationFunction } from '@renderer/components/settings/types';
import { Alert, AlertDescription } from '@renderer/components/ui/alert';
import { Button } from '@renderer/components/ui/button';
import { Field } from '@renderer/components/ui/field';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import { Switch } from '@renderer/components/ui/switch';
import { shouldWarnSocks5ProxyAuth } from '@shared/cloakBrowserSettings';

interface NetworkSectionProps {
  fieldError: FieldErrorRenderer;
  onBypassChange: (value: string) => void;
  onClearPassword: () => void;
  onEnabledChange: (value: boolean) => void;
  onGeoipChange: (value: boolean) => void;
  onPasswordChange: (value: string) => void;
  onServerChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  settings: EditableCloakBrowserSettings;
  t: TranslationFunction;
}

/** Edits proxy configuration and surfaces protocol-specific credential restrictions. */
function NetworkSection({
  fieldError,
  onBypassChange,
  onClearPassword,
  onEnabledChange,
  onGeoipChange,
  onPasswordChange,
  onServerChange,
  onUsernameChange,
  settings,
  t,
}: NetworkSectionProps): JSX.Element {
  const { proxy } = settings;
  const proxyDisabled = !proxy.enabled;
  const serverError = fieldError('proxyServer');
  const bypassError = fieldError('proxyBypass');
  const usernameError = fieldError('proxyUsername');
  const passwordError = fieldError('proxyPassword');
  const showSocks5AuthWarning = shouldWarnSocks5ProxyAuth(proxy);
  const hasSocks5AuthFieldError = Boolean(usernameError || passwordError);

  return (
    <section aria-labelledby="network-heading" className="grid gap-5 pb-4">
      <h2 className="text-base font-semibold text-foreground" id="network-heading">
        {t('appSettings.proxy')}
      </h2>

      <div className="grid gap-4 border-b border-border pb-5">
        <div className="flex min-h-10 items-center justify-between gap-4">
          <Label htmlFor="proxy-enabled">{t('appSettings.proxyEnabled')}</Label>
          <Switch
            aria-label={t('appSettings.proxyEnabled')}
            checked={proxy.enabled}
            id="proxy-enabled"
            onCheckedChange={onEnabledChange}
          />
        </div>

        {proxyDisabled && (
          <Alert>
            <AlertDescription>{t('appSettings.proxyDisabledHint')}</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="grid gap-4">
        <Field
          disabled={proxyDisabled}
          error={serverError}
          id="proxy-server"
          label={t('appSettings.proxyServer')}
          required={proxy.enabled}
        >
          <Input
            autoCapitalize="none"
            autoComplete="off"
            onChange={(event) => onServerChange(event.target.value)}
            placeholder="http://proxy.example.com:8080"
            spellCheck={false}
            type="text"
            value={proxy.server}
          />
        </Field>

        <div className="grid gap-4 min-[700px]:grid-cols-2">
          <Field disabled={proxyDisabled} error={bypassError} id="proxy-bypass" label={t('appSettings.proxyBypass')}>
            <Input
              autoCapitalize="none"
              autoComplete="off"
              onChange={(event) => onBypassChange(event.target.value)}
              spellCheck={false}
              type="text"
              value={proxy.bypass}
            />
          </Field>

          <Field
            disabled={proxyDisabled}
            error={usernameError}
            id="proxy-username"
            label={t('appSettings.proxyUsername')}
          >
            <Input
              autoCapitalize="none"
              autoComplete="username"
              onChange={(event) => onUsernameChange(event.target.value)}
              spellCheck={false}
              type="text"
              value={proxy.username}
            />
          </Field>
        </div>

        <Field
          disabled={proxyDisabled}
          error={passwordError}
          id="proxy-password"
          label={t('appSettings.proxyPassword')}
        >
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <Input
              autoComplete="new-password"
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder={proxy.hasPassword ? t('appSettings.proxyPasswordSaved') : t('appSettings.proxyPassword')}
              type="password"
              value={proxy.password}
            />
            <Button
              disabled={proxyDisabled || (!proxy.hasPassword && !proxy.password)}
              onClick={onClearPassword}
              size="sm"
              variant="outline"
            >
              {t('appSettings.clearProxyPassword')}
            </Button>
          </div>
        </Field>

        <div className="flex min-h-10 items-center justify-between gap-4 border-t border-border pt-4">
          <Label htmlFor="proxy-geoip">{t('appSettings.proxyGeoip')}</Label>
          <Switch
            aria-label={t('appSettings.proxyGeoip')}
            checked={proxy.geoip}
            disabled={proxyDisabled}
            id="proxy-geoip"
            onCheckedChange={onGeoipChange}
          />
        </div>

        {showSocks5AuthWarning && !hasSocks5AuthFieldError && (
          <Alert variant="warning">
            <AlertDescription>{t('appSettings.proxySocks5AuthWarning')}</AlertDescription>
          </Alert>
        )}
      </div>
    </section>
  );
}

export default NetworkSection;
