import type { ReactNode } from 'react';
import type { AppSettingsFieldKey } from '@renderer/appSettingsUtils';

export type FieldErrorRenderer = (fieldKey: AppSettingsFieldKey) => ReactNode;

export type TranslationFunction = (key: string, params?: Record<string, string>) => string;
