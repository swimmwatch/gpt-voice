export type BeforeBackgroundBrowserShutdownHook = () => void | Promise<void>;

const beforeShutdownHooks = new Set<BeforeBackgroundBrowserShutdownHook>();

export function registerBeforeBackgroundBrowserShutdownHook(hook: BeforeBackgroundBrowserShutdownHook): () => void {
  beforeShutdownHooks.add(hook);
  return () => {
    beforeShutdownHooks.delete(hook);
  };
}

export async function runBeforeBackgroundBrowserShutdownHooks(): Promise<void> {
  for (const hook of [...beforeShutdownHooks]) {
    try {
      await hook();
    } catch {
      // Browser teardown must continue even when an optional lifecycle hook fails.
    }
  }
}
