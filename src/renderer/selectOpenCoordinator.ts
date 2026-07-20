export interface SelectOpenCoordinator {
  activate(token: symbol, close: () => void): void;
  deactivate(token: symbol): void;
}

/** Keeps renderer dropdowns mutually exclusive without sharing component state. */
export function createSelectOpenCoordinator(): SelectOpenCoordinator {
  let active: { close: () => void; token: symbol } | null = null;

  return {
    activate(token, close) {
      if (active?.token !== token) {
        const previous = active;
        active = null;
        previous?.close();
      }
      active = { close, token };
    },
    deactivate(token) {
      if (active?.token === token) active = null;
    },
  };
}

export const selectOpenCoordinator = createSelectOpenCoordinator();
