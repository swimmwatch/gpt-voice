import { Save, X } from 'lucide-react';
import type { JSX } from 'react';
import { Alert, AlertDescription } from '@renderer/components/ui/alert';
import { Badge } from '@renderer/components/ui/badge';
import { Button } from '@renderer/components/ui/button';
import { Separator } from '@renderer/components/ui/separator';
import { Spinner } from '@renderer/components/ui/spinner';
import type { TranslationFunction } from '@renderer/components/settings/types';

interface SettingsFooterProps {
  error: string;
  isDirty: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSave: () => void;
  saveDisabled: boolean;
  t: TranslationFunction;
}

function SettingsFooter({
  error,
  isDirty,
  isSaving,
  onClose,
  onSave,
  saveDisabled,
  t,
}: SettingsFooterProps): JSX.Element {
  return (
    <footer className="grid shrink-0 gap-3" data-slot="settings-footer">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Separator />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-h-5">{isDirty && <Badge variant="warning">{t('common.unsavedChanges')}</Badge>}</div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button disabled={isSaving} onClick={onClose} variant="outline">
            <X aria-hidden="true" />
            {t('common.close')}
          </Button>
          <Button disabled={saveDisabled} onClick={onSave} variant="primary">
            {isSaving ? <Spinner label={t('appSettings.saving')} size="sm" /> : <Save aria-hidden="true" />}
            {isSaving ? t('appSettings.saving') : t('common.saveChanges')}
          </Button>
        </div>
      </div>
    </footer>
  );
}

export default SettingsFooter;
