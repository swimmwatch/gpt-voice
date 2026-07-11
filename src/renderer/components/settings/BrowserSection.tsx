import { ChevronDown, Fingerprint, RotateCcw } from 'lucide-react';
import { useEffect, useState, type JSX } from 'react';
import type { EditableCloakBrowserSettings } from '@renderer/appSettingsUtils';
import type { FieldErrorRenderer, TranslationFunction } from '@renderer/components/settings/types';
import { Alert, AlertDescription } from '@renderer/components/ui/alert';
import { Button } from '@renderer/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@renderer/components/ui/collapsible';
import { Field } from '@renderer/components/ui/field';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select';
import { Switch } from '@renderer/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip';
import { CLOAK_BROWSER_BACKGROUND_MODES, CLOAK_BROWSER_HUMAN_PRESETS } from '@shared/cloakBrowserSettings';

interface BrowserSectionProps {
  fieldError: FieldErrorRenderer;
  localeOptions: string[];
  onBackgroundModeChange: (value: EditableCloakBrowserSettings['backgroundMode']) => void;
  onFingerprintSeedChange: (value: string) => void;
  onHumanizeChange: (value: boolean) => void;
  onHumanPresetChange: (value: EditableCloakBrowserSettings['humanPreset']) => void;
  onLocaleChange: (value: string) => void;
  onResetFingerprint: () => void;
  onTimezoneChange: (value: string) => void;
  proxyGeoipActive: boolean;
  settings: EditableCloakBrowserSettings;
  t: TranslationFunction;
  timezoneOptions: string[];
}

function BrowserSection({
  fieldError,
  localeOptions,
  onBackgroundModeChange,
  onFingerprintSeedChange,
  onHumanizeChange,
  onHumanPresetChange,
  onLocaleChange,
  onResetFingerprint,
  onTimezoneChange,
  proxyGeoipActive,
  settings,
  t,
  timezoneOptions,
}: BrowserSectionProps): JSX.Element {
  const [isIdentityOpen, setIsIdentityOpen] = useState(false);
  const humanPresetError = fieldError('humanPreset');
  const backgroundModeError = fieldError('backgroundMode');
  const fingerprintSeedError = fieldError('fingerprintSeed');
  const localeError = fieldError('locale');
  const timezoneError = fieldError('timezone');
  const identityHasError = Boolean(fingerprintSeedError || localeError || timezoneError);
  const identitySummary = [settings.locale, settings.timezone].filter(Boolean).join(' · ') || t('appSettings.identity');

  useEffect(() => {
    if (!identityHasError) return undefined;

    // Validation errors arrive from the parent after a save attempt. Open the relevant disclosure on the next frame
    // so the user can immediately reach the invalid field without triggering a synchronous effect update.
    const animationFrame = window.requestAnimationFrame(() => setIsIdentityOpen(true));
    return () => window.cancelAnimationFrame(animationFrame);
  }, [identityHasError]);

  return (
    <section aria-labelledby="browser-heading" className="grid gap-5 pb-4">
      <h2 className="text-base font-semibold text-foreground" id="browser-heading">
        {t('appSettings.cloakBrowser')}
      </h2>

      <div className="grid gap-4 border-b border-border pb-5">
        <h3 className="text-sm font-semibold text-foreground">{t('appSettings.behavior')}</h3>

        <div className="flex min-h-10 items-center justify-between gap-4">
          <Label htmlFor="humanize-input">{t('appSettings.humanize')}</Label>
          <Switch
            aria-label={t('appSettings.humanize')}
            checked={settings.humanize}
            id="humanize-input"
            onCheckedChange={onHumanizeChange}
          />
        </div>

        <Field error={humanPresetError} id="human-preset" label={t('appSettings.humanPreset')}>
          <Select
            onValueChange={(value) => onHumanPresetChange(value as EditableCloakBrowserSettings['humanPreset'])}
            value={settings.humanPreset}
          >
            <SelectTrigger aria-invalid={Boolean(humanPresetError) || undefined} id="human-preset">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CLOAK_BROWSER_HUMAN_PRESETS.map((preset) => (
                <SelectItem key={preset} value={preset}>
                  {t(`appSettings.humanPreset.${preset}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field error={backgroundModeError} id="background-mode" label={t('appSettings.backgroundMode')}>
          <Select
            onValueChange={(value) => onBackgroundModeChange(value as EditableCloakBrowserSettings['backgroundMode'])}
            value={settings.backgroundMode}
          >
            <SelectTrigger aria-invalid={Boolean(backgroundModeError) || undefined} id="background-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CLOAK_BROWSER_BACKGROUND_MODES.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {t(`appSettings.backgroundMode.${mode}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Collapsible onOpenChange={setIsIdentityOpen} open={isIdentityOpen}>
        <div className="border-b border-border pb-2">
          <CollapsibleTrigger asChild>
            <Button aria-expanded={isIdentityOpen} className="w-full justify-between px-1" variant="ghost">
              <span className="flex min-w-0 items-center gap-2 text-left">
                <Fingerprint aria-hidden="true" className="size-4 shrink-0" />
                <span className="truncate">{t('appSettings.identity')}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                <span className="max-w-48 truncate" title={identitySummary}>
                  {identitySummary}
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={`size-4 transition-transform duration-[var(--duration-fast)] ${isIdentityOpen ? 'rotate-180' : ''}`}
                />
              </span>
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="pt-4">
            <div className="grid gap-4">
              <Field error={fingerprintSeedError} id="fingerprint-seed" label={t('appSettings.fingerprintSeed')}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <Input
                    inputMode="numeric"
                    onChange={(event) => onFingerprintSeedChange(event.target.value)}
                    spellCheck={false}
                    type="text"
                    value={settings.fingerprintSeed}
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        aria-label={t('appSettings.resetFingerprint')}
                        onClick={onResetFingerprint}
                        size="icon"
                        title={t('appSettings.resetFingerprint')}
                        variant="outline"
                      >
                        <RotateCcw aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('appSettings.resetFingerprint')}</TooltipContent>
                  </Tooltip>
                </div>
              </Field>

              {proxyGeoipActive && (
                <Alert>
                  <AlertDescription>{t('appSettings.localeTimezoneManagedByProxy')}</AlertDescription>
                </Alert>
              )}

              <Field
                disabled={proxyGeoipActive}
                error={localeError}
                id="browser-locale"
                label={t('appSettings.locale')}
              >
                <Select disabled={proxyGeoipActive} onValueChange={onLocaleChange} value={settings.locale}>
                  <SelectTrigger aria-invalid={Boolean(localeError) || undefined} id="browser-locale">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {localeOptions.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                disabled={proxyGeoipActive}
                error={timezoneError}
                id="browser-timezone"
                label={t('appSettings.timezone')}
              >
                <Select disabled={proxyGeoipActive} onValueChange={onTimezoneChange} value={settings.timezone}>
                  <SelectTrigger aria-invalid={Boolean(timezoneError) || undefined} id="browser-timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timezoneOptions.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </section>
  );
}

export default BrowserSection;
