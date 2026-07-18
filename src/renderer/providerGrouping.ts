import type { ProviderCategory, ProviderInfo } from './types';

const PROVIDER_CATEGORY_ORDER: readonly ProviderCategory[] = ['web', 'api', 'local'];

export interface ProviderGroup {
  category: ProviderCategory;
  providers: ProviderInfo[];
}

/** Groups providers for display in the fixed Web, API, Local order. */
export function groupProvidersByCategory(providers: readonly ProviderInfo[]): ProviderGroup[] {
  return PROVIDER_CATEGORY_ORDER.map((category) => ({
    category,
    providers: providers
      .filter((provider) => provider.category === category)
      .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)),
  })).filter((group) => group.providers.length > 0);
}
