import {
  PRETTIFY_PROVIDER_UNAVAILABLE_ERROR,
  type PreparedPrettifyExecution,
  type TextProcessingResult,
} from '@main/services/prettifyProviderBase';
import type { KnownPrettifyProviderId } from '@shared/prettifySettings';

/** Owns the one-shot invariant for a prepared Prettify execution. */
export class OneShotPrettifyExecution implements PreparedPrettifyExecution {
  private consumed = false;

  public constructor(
    public readonly providerId: KnownPrettifyProviderId,
    public readonly cacheContext: readonly string[],
    private readonly executeOnce: (text: string) => Promise<TextProcessingResult>,
  ) {}

  public async execute(text: string): Promise<TextProcessingResult> {
    if (this.consumed) return { success: false, error: PRETTIFY_PROVIDER_UNAVAILABLE_ERROR };
    this.consumed = true;
    return this.executeOnce(text);
  }
}
