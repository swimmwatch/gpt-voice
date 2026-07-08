export type SelectedTextAction = 'translate' | 'prettify';

export interface SelectedTextActionGate {
  tryBegin(action: SelectedTextAction): boolean;
  finish(action: SelectedTextAction): void;
  getActive(): SelectedTextAction | null;
  reset(): void;
}

export function createSelectedTextActionGate(): SelectedTextActionGate {
  let activeAction: SelectedTextAction | null = null;

  return {
    tryBegin(action) {
      if (activeAction) {
        return false;
      }
      activeAction = action;
      return true;
    },
    finish(action) {
      if (activeAction === action) {
        activeAction = null;
      }
    },
    getActive() {
      return activeAction;
    },
    reset() {
      activeAction = null;
    },
  };
}

const defaultSelectedTextActionGate = createSelectedTextActionGate();

export function tryBeginSelectedTextAction(action: SelectedTextAction): boolean {
  return defaultSelectedTextActionGate.tryBegin(action);
}

export function finishSelectedTextAction(action: SelectedTextAction): void {
  defaultSelectedTextActionGate.finish(action);
}

export function getActiveSelectedTextAction(): SelectedTextAction | null {
  return defaultSelectedTextActionGate.getActive();
}

export function resetSelectedTextActionState(): void {
  defaultSelectedTextActionGate.reset();
}

export const selectedTextActionGate = defaultSelectedTextActionGate;
