import type { ElectronAPI } from '@renderer/types';
import { createSelectOpenCoordinator, type SelectOpenCoordinator } from '@renderer/selectOpenCoordinator';
import { createContext, use, useMemo, type ReactNode } from 'react';

const MISSING_DESKTOP_API_ERROR = 'DesktopApiProvider is required';
const MISSING_SELECT_COORDINATOR_ERROR = 'DesktopApiProvider select coordinator is required';

const DesktopApiContext = createContext<ElectronAPI | null>(null);
const SelectOpenCoordinatorContext = createContext<SelectOpenCoordinator | null>(null);

interface DesktopApiProviderProps {
  api: ElectronAPI;
  children: ReactNode;
}

/** Owns renderer API and mutable UI coordinator state for one window root. */
export function DesktopApiProvider({ api, children }: DesktopApiProviderProps): React.JSX.Element {
  const selectOpenCoordinator = useMemo(() => createSelectOpenCoordinator(), []);

  return (
    <DesktopApiContext value={api}>
      <SelectOpenCoordinatorContext value={selectOpenCoordinator}>{children}</SelectOpenCoordinatorContext>
    </DesktopApiContext>
  );
}

export function useDesktopApi(): ElectronAPI {
  const api = use(DesktopApiContext);
  if (!api) throw new Error(MISSING_DESKTOP_API_ERROR);
  return api;
}

export function useSelectOpenCoordinator(): SelectOpenCoordinator {
  const coordinator = use(SelectOpenCoordinatorContext);
  if (!coordinator) throw new Error(MISSING_SELECT_COORDINATOR_ERROR);
  return coordinator;
}
