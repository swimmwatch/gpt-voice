import type { ProviderInfo, ProviderSettings } from '@renderer/types';

/** Reads the single provider identifier emitted by main for a dedicated settings window. */
export function getProviderSettingsWindowProviderId(search: string): string | null {
  const providerIds = new URLSearchParams(search).getAll('providerId');
  if (providerIds.length !== 1) return null;

  const [providerId] = providerIds;
  return providerId && providerId.trim() === providerId ? providerId : null;
}

/** Resolves only providers that explicitly declare a renderer settings surface. */
export function findSettingsProvider(
  providers: readonly ProviderInfo[],
  providerId: string | null,
): ProviderInfo | null {
  if (!providerId) return null;
  return providers.find((provider) => provider.id === providerId && provider.hasSettings) ?? null;
}

export function isMatchingProviderSettings(settings: ProviderSettings, providerId: string): boolean {
  return settings.providerId === providerId;
}
