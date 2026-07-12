import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import-x';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import tsdoc from 'eslint-plugin-tsdoc';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['**/lib/**', '**/build/**', '**/docs/**', '**/coverage/**'],
  },

  js.configs.recommended,
  importPlugin.flatConfigs.recommended,
  {
    // Default imports of packages that also expose named exports (e.g. sinon).
    rules: { 'import-x/no-named-as-default-member': 'off' },
  },

  // TypeScript sources — type-aware strict rules.
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node },
    },
    plugins: { tsdoc },
    rules: {
      'tsdoc/syntax': 'off',
      'no-void': 'off',
      // TypeScript resolves imports itself (verified by `tsc --noEmit`).
      'import-x/no-unresolved': 'off',
      'import-x/extensions': 'off',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': 'allow-with-description',
          'ts-nocheck': 'allow-with-description',
          'ts-check': 'allow-with-description',
        },
      ],
      // Rules newly added/tightened in typescript-eslint v8 that this codebase
      // predates and that flag style, not bugs — kept off to match prior intent.
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-useless-default-assignment': 'off',
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'off',
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
      // Code propagates caught errors verbatim; wrapping every one in `new Error`
      // adds noise, and a cast trips no-unnecessary-type-assertion.
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
    },
  },

  // ESM config files (e.g. this one).
  {
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: { 'import-x/no-unresolved': 'off' },
  },

  // Plain JavaScript (tests, examples) — no type-aware rules.
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'import-x/no-unresolved': 'off',
      'import-x/extensions': 'off',
    },
  },

  // Test files (in any package).
  {
    files: ['**/test/**'],
    languageOptions: { globals: { ...globals.mocha } },
    rules: {
      'func-names': 'off',
      'no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },

  // Examples may log to the console.
  {
    files: ['**/examples/**'],
    rules: { 'no-console': 'off' },
  },

  // Prettier last — turns off stylistic rules and reports formatting diffs.
  prettierRecommended,

  {
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },
);
