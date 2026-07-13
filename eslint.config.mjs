import js from '@eslint/js';
import eslintReact from '@eslint-react/eslint-plugin';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import prettier from 'eslint-config-prettier';
import eslintComments from 'eslint-plugin-eslint-comments';
import importX from 'eslint-plugin-import-x';
import jsdoc from 'eslint-plugin-jsdoc';
import n from 'eslint-plugin-n';
import noUnsanitized from 'eslint-plugin-no-unsanitized';
import perfectionist from 'eslint-plugin-perfectionist';
import promise from 'eslint-plugin-promise';
import reactHooks from 'eslint-plugin-react-hooks';
import regexp from 'eslint-plugin-regexp';
import security from 'eslint-plugin-security';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from 'typescript-eslint';

const tsFiles = ['src/**/*.{ts,tsx}', 'tests/**/*.ts', 'vite.landing.config.ts', 'playwright.landing.config.ts'];
const landingBrowserFiles = ['src/landing-page/**/*.{ts,tsx}'];
const landingNodeFiles = ['src/landing-page/build/**/*.ts', 'vite.landing.config.ts', 'playwright.landing.config.ts'];
const rendererFiles = ['src/renderer/**/*.{ts,tsx}'];
const nodeFiles = ['src/main/**/*.ts', 'tests/**/*.ts', 'scripts/**/*.mjs', 'eslint.config.mjs', 'webpack.config.js'];
const jsFiles = ['scripts/**/*.mjs', 'eslint.config.mjs', 'webpack.config.js'];
const browserGlobals = {
  AudioContext: 'readonly',
  Blob: 'readonly',
  FileReader: 'readonly',
  MediaRecorder: 'readonly',
  URL: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  window: 'readonly',
};
const nodeGlobals = {
  AbortController: 'readonly',
  ArrayBuffer: 'readonly',
  Blob: 'readonly',
  Buffer: 'readonly',
  FormData: 'readonly',
  URL: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  console: 'readonly',
  fetch: 'readonly',
  globalThis: 'readonly',
  module: 'readonly',
  process: 'readonly',
  require: 'readonly',
  setTimeout: 'readonly',
};

function warnRules(rules = {}) {
  return Object.fromEntries(Object.keys(rules).map((ruleName) => [ruleName, 'warn']));
}

export default tseslint.config(
  {
    ignores: ['build/github-pages/**', 'dist/**', 'release/**', 'node_modules/**', 'src/landing-page/public/generated/**'],
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    plugins: {
      'eslint-comments': eslintComments,
      'import-x': importX,
      jsdoc,
      perfectionist,
      promise,
      regexp,
      sonarjs,
      unicorn,
      'unused-imports': unusedImports,
    },
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          alwaysTryTypes: true,
          noWarnOnMultipleProjects: true,
          project: ['./tsconfig.json', './tsconfig.test.json', './tsconfig.landing.json', './tsconfig.landing.node.json'],
        }),
      ],
    },
    rules: {
      ...js.configs.recommended.rules,
      ...importX.flatConfigs.recommended.rules,
      ...importX.flatConfigs.typescript.rules,
      ...promise.configs['flat/recommended'].rules,
      ...regexp.configs['flat/recommended'].rules,
      'eslint-comments/no-unused-disable': 'error',
      'import-x/no-cycle': 'warn',
      'import-x/no-duplicates': 'error',
      'import-x/no-unresolved': ['error', { commonjs: true }],
      complexity: ['warn', 35],
      'jsdoc/require-description': 'warn',
      'jsdoc/require-jsdoc': ['warn', { contexts: ['ClassDeclaration'], require: { FunctionDeclaration: false } }],
      'max-classes-per-file': ['warn', 1],
      'max-depth': ['warn', 5],
      'max-lines-per-function': ['warn', { max: 800, skipBlankLines: true, skipComments: true }],
      'max-params': ['warn', 6],
      'max-statements': ['warn', 80],
      'perfectionist/sort-exports': ['warn', { type: 'natural' }],
      'perfectionist/sort-imports': 'off',
      'promise/always-return': 'off',
      'promise/catch-or-return': 'off',
      'sonarjs/cognitive-complexity': ['warn', 35],
      'sonarjs/no-all-duplicated-branches': 'warn',
      'sonarjs/no-duplicated-branches': 'warn',
      'sonarjs/no-identical-conditions': 'warn',
      'sonarjs/no-identical-expressions': 'warn',
      'sonarjs/no-identical-functions': 'warn',
      'unicorn/catch-error-name': ['warn', { name: 'error' }],
      'unicorn/no-abusive-eslint-disable': 'error',
      'unicorn/prefer-node-protocol': 'warn',
      'unicorn/throw-new-error': 'error',
    },
  },
  {
    files: tsFiles,
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-base-to-string': 'warn',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-implied-eval': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-enum-comparison': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/unbound-method': 'warn',
      'unused-imports/no-unused-imports': 'warn',
      'unused-imports/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: landingBrowserFiles,
    ignores: ['src/landing-page/build/**/*.ts'],
    languageOptions: {
      globals: browserGlobals,
      parserOptions: {
        project: './tsconfig.landing.json',
        projectService: false,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: landingNodeFiles,
    languageOptions: {
      globals: nodeGlobals,
      parserOptions: {
        project: './tsconfig.landing.node.json',
        projectService: false,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: rendererFiles,
    languageOptions: {
      globals: browserGlobals,
    },
    plugins: {
      'no-unsanitized': noUnsanitized,
    },
    rules: {
      ...noUnsanitized.configs.recommended.rules,
    },
  },
  {
    files: nodeFiles,
    languageOptions: {
      globals: nodeGlobals,
    },
    plugins: {
      n,
      security,
    },
    rules: {
      ...warnRules(n.configs['flat/recommended'].rules),
      ...warnRules(security.configs.recommended.rules),
      'n/no-missing-import': 'off',
      'n/no-missing-require': 'off',
      'n/no-process-exit': 'off',
      'n/no-unpublished-import': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-object-injection': 'off',
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/require-await': 'off',
      'jsdoc/require-jsdoc': 'off',
      'max-lines-per-function': 'off',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'jsdoc/require-jsdoc': [
        'warn',
        {
          contexts: [
            'ClassDeclaration',
            { context: 'FunctionDeclaration', minLineCount: 80 },
            { context: 'FunctionExpression', minLineCount: 80 },
            { context: 'ArrowFunctionExpression', minLineCount: 80 },
            { context: 'MethodDefinition', minLineCount: 80 },
          ],
          require: { FunctionDeclaration: false },
        },
      ],
    },
  },
  {
    files: jsFiles,
    languageOptions: {
      globals: nodeGlobals,
      sourceType: 'module',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      eslintReact.configs['strict-type-checked'],
      eslintReact.configs['disable-conflict-eslint-plugin-react-hooks'],
    ],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-console': 'warn',
    },
  },
  prettier,
);
