import { createContext, use, useMemo, type ReactNode } from 'react';

const MISSING_RENDERER_LOGGER_ERROR = 'RendererLoggerProvider is required';

export interface RendererLogger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export interface RendererLoggerFactory {
  scope(scope: string): RendererLogger;
}

const RendererLoggerContext = createContext<RendererLoggerFactory | null>(null);

interface RendererLoggerProviderProps {
  readonly children: ReactNode;
  readonly factory: RendererLoggerFactory;
}

/** Provides the renderer entry root's logger factory without module-owned scoped logger instances. */
export function RendererLoggerProvider({ children, factory }: RendererLoggerProviderProps): React.JSX.Element {
  return <RendererLoggerContext value={factory}>{children}</RendererLoggerContext>;
}

export function useRendererLogger(scope: string): RendererLogger {
  const factory = use(RendererLoggerContext);
  if (!factory) throw new Error(MISSING_RENDERER_LOGGER_ERROR);
  return useMemo(() => factory.scope(scope), [factory, scope]);
}
