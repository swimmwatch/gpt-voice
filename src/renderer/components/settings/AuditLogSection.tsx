import { Trash2 } from 'lucide-react';
import type { JSX } from 'react';
import type { TranslationFunction } from '@renderer/components/settings/types';
import { Alert, AlertDescription, AlertTitle } from '@renderer/components/ui/alert';
import { Button } from '@renderer/components/ui/button';
import { Label } from '@renderer/components/ui/label';
import { Switch } from '@renderer/components/ui/switch';
import type { DiagnosticCaptureClearTarget, DiagnosticCaptureSettings } from '@shared/diagnosticCaptureSettings';
import { DIAGNOSTIC_CAPTURE_CLEAR_TARGETS } from '@shared/diagnosticCaptureSettings';

interface AuditLogSectionProps {
  disabled: boolean;
  onClear: (target: DiagnosticCaptureClearTarget) => void;
  onSettingChange: (key: keyof DiagnosticCaptureSettings, enabled: boolean) => void;
  settings: DiagnosticCaptureSettings;
  t: TranslationFunction;
}

function AuditLogSection({ disabled, onClear, onSettingChange, settings, t }: AuditLogSectionProps): JSX.Element {
  return (
    <section aria-labelledby="audit-log-heading" className="grid gap-5 pb-4">
      <div className="grid gap-1">
        <h2 className="text-base font-semibold text-foreground" id="audit-log-heading">
          {t('auditLog.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('auditLog.description')}</p>
      </div>

      <div className="grid gap-4 border-b border-border pb-5">
        <div className="flex min-h-10 items-start justify-between gap-4">
          <div className="grid gap-1">
            <Label htmlFor="capture-translation-diagnostics">{t('auditLog.captureTranslation')}</Label>
            <p className="text-xs text-muted-foreground">{t('auditLog.captureTranslationDescription')}</p>
          </div>
          <Switch
            aria-label={t('auditLog.captureTranslation')}
            checked={settings.captureTranslationDiagnostics}
            disabled={disabled}
            id="capture-translation-diagnostics"
            onCheckedChange={(enabled) => onSettingChange('captureTranslationDiagnostics', enabled)}
          />
        </div>

        <div className="flex min-h-10 items-start justify-between gap-4">
          <div className="grid gap-1">
            <Label htmlFor="capture-prettify-diagnostics">{t('auditLog.capturePrettify')}</Label>
            <p className="text-xs text-muted-foreground">{t('auditLog.capturePrettifyDescription')}</p>
          </div>
          <Switch
            aria-label={t('auditLog.capturePrettify')}
            checked={settings.capturePrettifyDiagnostics}
            disabled={disabled}
            id="capture-prettify-diagnostics"
            onCheckedChange={(enabled) => onSettingChange('capturePrettifyDiagnostics', enabled)}
          />
        </div>
      </div>

      <Alert variant="warning">
        <AlertTitle>{t('auditLog.privacyTitle')}</AlertTitle>
        <AlertDescription>
          <ul className="list-disc space-y-1 pl-4">
            <li>{t('auditLog.sensitiveDataWarning')}</li>
            <li>{t('auditLog.plaintextStorageWarning')}</li>
            <li>{t('auditLog.redactionLimitWarning')}</li>
            <li>{t('auditLog.archiveInclusionWarning')}</li>
            <li>{t('auditLog.archiveEncryptionWarning')}</li>
          </ul>
        </AlertDescription>
      </Alert>

      <div className="grid gap-3">
        <h3 className="text-sm font-semibold text-foreground">{t('auditLog.clearTitle')}</h3>
        <p className="text-xs text-muted-foreground">{t('auditLog.clearDescription')}</p>
        <div className="flex flex-wrap gap-2">
          {DIAGNOSTIC_CAPTURE_CLEAR_TARGETS.map((target) => (
            <Button disabled={disabled} key={target} onClick={() => onClear(target)} size="sm" variant="destructive">
              <Trash2 aria-hidden="true" />
              {t(`auditLog.clear.${target}`)}
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}

export default AuditLogSection;
