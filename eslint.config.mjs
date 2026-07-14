// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import unusedImports from "eslint-plugin-unused-imports";
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    plugins: {
      "unused-imports": unusedImports,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      // Error (not warn): an unawaited async DB call on the per-request
      // EntityManager (e.g. a bare `securityEvents.record(...)`) runs detached
      // and races onResponse's `em.clear()`, stranding the connection
      // "idle in transaction". Await it, or run it on an isolated `em.fork()`.
      '@typescript-eslint/no-floating-promises': 'error',
      // no-floating-promises treats `.catch()` as "handled", so it misses
      // fire-and-forget flushes like `em.flush().catch(...)`. Those are the
      // most dangerous form on a shared em (they can also run concurrently
      // with the handler's own queries on the single connection). Forbid them:
      // await the flush, or do an isolated `em.fork().nativeUpdate(...)`.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.property.name='catch'][callee.object.callee.property.name='flush']",
          message:
            'Fire-and-forget flush (`.flush().catch(...)`) on a shared EntityManager races request teardown and can strand the connection idle-in-transaction. Await the flush, or perform the write on an isolated `em.fork().nativeUpdate(...)`.',
        },
      ],
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      "unused-imports/no-unused-imports": "error",
        "unused-imports/no-unused-vars": [
          "warn",
          {
            "vars": "all",
            "varsIgnorePattern": "^_",
            "args": "after-used",
            "argsIgnorePattern": "^_",
          },
        ]
    },
  },
);