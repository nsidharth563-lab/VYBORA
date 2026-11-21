// Lint config for Node/TS workspaces (api + packages). apps/mobile uses eslint-config-expo.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/generated/**',
      '**/coverage/**',
      'apps/mobile/**',
      'apps/admin/**',
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports', disallowTypeAnnotations: false }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
    },
  },
  {
    // NestJS DI reads constructor param types via emitDecoratorMetadata — they must
    // stay value imports, so `import type` auto-fixes would break injection at runtime.
    files: ['apps/api/**/*.ts'],
    rules: { '@typescript-eslint/consistent-type-imports': 'off' },
  },
  {
    files: ['**/*.spec.ts', '**/*.test.ts', '**/test/**/*.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
);
