import { Config, type WebpackConfiguration } from '@remotion/cli/config';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { RuleSetRule } from 'webpack';

const videoRoot = process.cwd();
const require = createRequire(path.join(videoRoot, 'package.json'));
const repoRoot = path.resolve(videoRoot, '../..');
const globalStyles = path.join(repoRoot, 'src/renderer/styles/globals.css');
const videoI18n = path.join(repoRoot, 'media/video/src/product-ui/videoI18n.ts');

function resolveFromRepo(packageName: string): string {
  return require.resolve(packageName, { paths: [repoRoot] });
}

function isDefaultCssRule(rule: RuleSetRule): boolean {
  return rule.test instanceof RegExp && rule.test.test('globals.css');
}

function configureRendererSource(currentConfiguration: WebpackConfiguration): WebpackConfiguration {
  const defaultCssRule = currentConfiguration.module?.rules?.find(
    (rule): rule is RuleSetRule => typeof rule === 'object' && rule !== null && isDefaultCssRule(rule),
  );

  if (!defaultCssRule) {
    throw new Error('Remotion CSS loader rule is required to compile the canonical renderer styles.');
  }

  const aliases = currentConfiguration.resolve?.alias;
  if (Array.isArray(aliases)) {
    throw new Error('Remotion aliases must use an object map.');
  }

  return {
    ...currentConfiguration,
    module: {
      ...currentConfiguration.module,
      rules: [
        ...(currentConfiguration.module?.rules?.map((rule) =>
          rule === defaultCssRule ? { ...rule, exclude: globalStyles } : rule,
        ) ?? []),
        {
          include: globalStyles,
          test: /\.css$/i,
          type: 'javascript/auto',
          use: [
            resolveFromRepo('style-loader'),
            {
              loader: resolveFromRepo('css-loader'),
              options: {
                modules: {
                  auto: true,
                  namedExport: false,
                },
              },
            },
            {
              loader: resolveFromRepo('postcss-loader'),
              options: {
                postcssOptions: {
                  config: path.join(repoRoot, 'postcss.config.js'),
                },
              },
            },
          ],
        },
      ],
    },
    resolve: {
      ...currentConfiguration.resolve,
      alias: {
        ...aliases,
        '@main': path.join(repoRoot, 'src/main'),
        '@renderer': path.join(repoRoot, 'src/renderer'),
        '@renderer/hooks/useI18n$': videoI18n,
        '@shared': path.join(repoRoot, 'src/shared'),
        react: require.resolve('react'),
        'react-dom': require.resolve('react-dom'),
        'react-dom/client': require.resolve('react-dom/client'),
        'react/jsx-dev-runtime': require.resolve('react/jsx-dev-runtime'),
        'react/jsx-runtime': require.resolve('react/jsx-runtime'),
      },
    },
  };
}

Config.setChromiumOpenGlRenderer('angle');
Config.setEntryPoint('./src/index.ts');
Config.overrideWebpackConfig(configureRendererSource);
