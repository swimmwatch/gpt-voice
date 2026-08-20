/** Owns the bounded global-shortcut operations used by one registration service. */
export abstract class GlobalShortcutAdapter {
  public abstract isRegistered(accelerator: string): boolean;
  public abstract register(accelerator: string, callback: () => void): boolean;
  public abstract unregister(accelerator: string): boolean;
  public abstract unregisterAll(): void;
}
