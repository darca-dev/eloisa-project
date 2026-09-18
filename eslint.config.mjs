// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Configuración lint centralizada del monorepo MERDN (TASK-001, FR-17).
 *
 * Se centraliza en la raíz para evitar reglas duplicadas por workspace.
 * No se desactivan reglas de forma global: las excepciones son acotadas y
 * justificadas por archivo o por patrón.
 */
export default tseslint.config(
  {
    // Áreas protegidas, generadas o ajenas al código productivo.
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      'apps/web/.next/**',
      'apps/web/next-env.d.ts',
      'apps/api/src/generated/**',
      // Referencia protegida de solo lectura: nunca se lintea ni se modifica.
      'prototype-claude/**',
      // Documentación y gobernanza.
      'docs/**',
      'tasks/**',
      'reviews/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-console': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  {
    // Componentes React del frontend.
    files: ['apps/web/**/*.tsx'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  },

  {
    // Scripts de verificación técnica ejecutados desde la línea de comandos:
    // su salida por consola es la evidencia exigida por TASK-001.
    files: ['tests/**/*.mjs'],
    rules: {
      'no-console': 'off',
    },
  },
);
