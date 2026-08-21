import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

export const RENDERER_WINDOW_ENTRIES = Object.freeze([
  Object.freeze({ entry: 'main', htmlFile: 'index.html' }),
  Object.freeze({ entry: 'providerSettings', htmlFile: 'provider-settings.html' }),
  Object.freeze({ entry: 'prettifyProfileChooser', htmlFile: 'prettify-profile-chooser.html' }),
  Object.freeze({ entry: 'settings', htmlFile: 'settings.html' }),
  Object.freeze({ entry: 'history', htmlFile: 'history.html' }),
  Object.freeze({ entry: 'about', htmlFile: 'about.html' }),
] as const);

function verificationError(code: string): Error {
  const error = new Error(code);
  error.name = 'RendererBundleVerificationError';
  return error;
}

function verify(condition: boolean, code: string): asserts condition {
  if (!condition) throw verificationError(code);
}

/** Verifies renderer production invariants against the output of the existing full application build. */
export class RendererBundleVerifier {
  public constructor(private readonly outputRoot: string) {}

  public async verify(): Promise<void> {
    const outputFiles = await readdir(this.outputRoot);
    verify(outputFiles.includes('main.js'), 'MAIN_BUNDLE_MISSING');
    verify(!outputFiles.includes('provider-hotkey-demo.html'), 'DEVELOPMENT_DEMO_EMITTED');
    await readFile(path.join(this.outputRoot, 'renderer', 'main.js'));

    const workletSource = await readFile(
      path.join(this.outputRoot, 'renderer', 'assets', 'livePcmCapture.worklet.js'),
      'utf8',
    );
    verify(/gpt-voice-live-pcm-capture/u.test(workletSource), 'WORKLET_MARKER_MISSING');
    verify(/registerProcessor/u.test(workletSource), 'WORKLET_REGISTRATION_MISSING');
    verify(!/https?:\/\//u.test(workletSource), 'WORKLET_REMOTE_REFERENCE');

    for (const { entry, htmlFile } of RENDERER_WINDOW_ENTRIES) {
      const html = await readFile(path.join(this.outputRoot, htmlFile), 'utf8');
      verify(html.includes(`src="renderer/${entry}.js"`), 'WINDOW_ENTRY_MISSING');
      const cssHrefs = [...html.matchAll(/<link[^>]+href="(renderer\/[^"<>]+\.css)"/gu)].map((match) => match[1] ?? '');
      verify(cssHrefs.length > 0, 'WINDOW_CSS_MISSING');
      verify(new Set(cssHrefs).size === cssHrefs.length, 'WINDOW_CSS_DUPLICATED');
      for (const cssHref of cssHrefs) {
        verify(
          !cssHref.includes('\\') &&
            cssHref.split('/').every((segment) => segment.length > 0 && segment !== '.' && segment !== '..'),
          'WINDOW_CSS_PATH_INVALID',
        );
        const css = await readFile(path.join(this.outputRoot, cssHref), 'utf8');
        verify(!css.includes('\n'), 'WINDOW_CSS_NOT_MINIFIED');
      }
      for (const { entry: otherEntry } of RENDERER_WINDOW_ENTRIES) {
        if (otherEntry !== entry) {
          verify(!html.includes(`src="renderer/${otherEntry}.js"`), 'WINDOW_ENTRY_CROSSED');
        }
      }
    }
  }
}

async function runVerificationCommand(): Promise<void> {
  try {
    await new RendererBundleVerifier(path.resolve('dist')).verify();
    process.stdout.write('Verified production renderer bundle layout.\n');
  } catch (error: unknown) {
    const code =
      error instanceof Error && error.name === 'RendererBundleVerificationError'
        ? error.message
        : 'RENDERER_BUNDLE_INVALID';
    process.stderr.write(`Renderer bundle verification failed: ${code}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void runVerificationCommand();
}
