import { BaseProviderAudit, type ProviderAuditDependencies } from '@main/providerAudit';

/** Main-only Prettify audit family adapter reserved for the Prettify lifecycle packets. */
export class PrettifyProviderAudit extends BaseProviderAudit<'prettify'> {
  public readonly family = 'prettify' as const;

  public constructor(dependencies: Partial<ProviderAuditDependencies> = {}) {
    super(dependencies);
  }
}

export const prettifyProviderAudit = new PrettifyProviderAudit();
