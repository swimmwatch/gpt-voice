import type { PrettifyProfileChooserAPI } from '@shared/prettifyProfileChooser';

/** Renderer-entry global for the isolated Prettify chooser only. */
export type PrettifyProfileChooserRendererWindow = Window & {
  readonly electronAPI: PrettifyProfileChooserAPI;
};
