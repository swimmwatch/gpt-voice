import { TranslationBrowserResourceCoordinator } from '@main/translateProviders/TranslationBrowserResourceCoordinator';
import type { BaseTranslateProviderDependencies } from '@main/translateProviders/BaseTranslateProvider';

type TestTranslationBrowserDependencies = Pick<
  BaseTranslateProviderDependencies,
  'cloakBrowserSettings' | 'createContext' | 'createContextOptions'
>;

/** Adds the explicitly owned nonpersistent browser coordinator required by provider test harnesses. */
export function withTestTranslationBrowserResources<Dependencies extends object>(
  dependencies: Dependencies & TestTranslationBrowserDependencies,
): NoInfer<Dependencies> & Pick<BaseTranslateProviderDependencies, 'browserResources'> {
  return {
    ...dependencies,
    browserResources: new TranslationBrowserResourceCoordinator({
      cloakBrowserSettings: dependencies.cloakBrowserSettings,
      createContext: dependencies.createContext,
      createContextOptions: dependencies.createContextOptions,
      retainContextAfterPageClose: false,
    }),
  };
}
