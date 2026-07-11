export type SettingsCloseDisposition = 'block' | 'close' | 'confirm';

interface SettingsCloseState {
  isDirty: boolean;
  isSaving: boolean;
}

export function getSettingsCloseDisposition({ isDirty, isSaving }: SettingsCloseState): SettingsCloseDisposition {
  if (isSaving) return 'block';
  return isDirty ? 'confirm' : 'close';
}
