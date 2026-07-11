export enum WindowStartupState {
  Loading = 'loading',
  Ready = 'ready',
}

export function getWindowStartupState(isContentReady: boolean): WindowStartupState {
  return isContentReady ? WindowStartupState.Ready : WindowStartupState.Loading;
}
