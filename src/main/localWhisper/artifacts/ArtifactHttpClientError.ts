/** Sanitized error exposed by an injected artifact HTTP client. */
export class ArtifactHttpClientError extends Error {
  public constructor(public readonly code: 'offline' | 'failed') {
    super(code);
    this.name = 'ArtifactHttpClientError';
  }
}
