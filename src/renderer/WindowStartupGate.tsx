import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react';
import { getWindowStartupState, WindowStartupState } from '@renderer/windowStartupState';

const WindowStartupContext = createContext<() => void>(() => undefined);

interface WindowStartupGateProps {
  children: ReactNode;
}

function WindowStartupGate({ children }: WindowStartupGateProps): React.JSX.Element {
  const [isContentReady, setIsContentReady] = useState(false);
  const startupState = getWindowStartupState(isContentReady);
  const markContentReady = useCallback((): void => {
    setIsContentReady(true);
  }, []);

  useEffect(() => {
    const loader = document.getElementById('window-startup-loader');
    loader?.setAttribute('data-state', startupState);
    document.body.dataset.windowStartup = startupState;
  }, [startupState]);

  return (
    <WindowStartupContext value={markContentReady}>
      <div
        aria-hidden={startupState === WindowStartupState.Loading}
        data-state={startupState}
        id="window-startup-content"
      >
        {children}
      </div>
    </WindowStartupContext>
  );
}

export function useWindowStartupReady(isReady: boolean): void {
  const markContentReady = use(WindowStartupContext);

  useEffect(() => {
    if (!isReady) {
      return undefined;
    }

    const animationFrame = window.requestAnimationFrame(markContentReady);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [isReady, markContentReady]);
}

export default WindowStartupGate;
