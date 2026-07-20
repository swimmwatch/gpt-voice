import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import axe from 'axe-core';

const repositoryRoot = path.resolve(__dirname, '../../..');
const defaultOutputDirectory = path.join(repositoryRoot, 'build/github-pages');

type AxeWindow = Window & typeof globalThis & { axe: typeof axe };
type JSDOMConstructor = new (
  document: string,
  options: { runScripts: 'outside-only'; url: string },
) => { window: AxeWindow };
const { JSDOM } = createRequire(__filename)('jsdom') as { JSDOM: JSDOMConstructor };

export async function verifyAccessibility(outputDirectory = defaultOutputDirectory): Promise<void> {
  const document = await readFile(path.join(outputDirectory, 'index.html'), 'utf8');
  const dom = new JSDOM(document, {
    runScripts: 'outside-only',
    url: 'https://swimmwatch.github.io/gpt-voice/',
  });

  try {
    const window = dom.window;
    window.eval(axe.source);
    const result = await window.axe.run(window.document, {
      rules: {
        // JSDOM has no layout engine, so axe cannot calculate foreground/background contrast here.
        'color-contrast': { enabled: false },
      },
    });

    if (result.violations.length > 0) {
      throw new Error(
        `Landing accessibility violations:\n${result.violations
          .map((violation) => `- ${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`)
          .join('\n')}`,
      );
    }
  } finally {
    dom.window.close();
  }
}

if (process.argv[1]?.endsWith(path.join('src', 'landing-page', 'build', 'verify-accessibility.ts'))) {
  void verifyAccessibility().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
