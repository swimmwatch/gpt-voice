/** Prevents inactive-provider settings and auth changes from restarting or switching the active provider. */
export function shouldRefreshProviderAfterMutation(changedProviderId: string, activeProviderId: string): boolean {
  return changedProviderId === activeProviderId;
}
