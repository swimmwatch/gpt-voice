export const REPOSITORY_ERROR_CODES = {
  OperationFailed: 'repository-operation-failed',
  Unavailable: 'repository-unavailable',
} as const;

export type RepositoryErrorCode = (typeof REPOSITORY_ERROR_CODES)[keyof typeof REPOSITORY_ERROR_CODES];

/** Content-free repository failure safe to translate at a service boundary. */
export class RepositoryError extends Error {
  public constructor(public readonly code: RepositoryErrorCode) {
    super(code);
    this.name = 'RepositoryError';
  }
}

export function normalizeRepositoryError(error: unknown): RepositoryError {
  return error instanceof RepositoryError ? error : new RepositoryError(REPOSITORY_ERROR_CODES.OperationFailed);
}
