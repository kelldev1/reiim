import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    // dist / deps / backups + fonctions Deno (lintées par `deno lint`).
    ignores: [
      'dist',
      'node_modules',
      'public/**',
      'supabase/functions/**',
      '**/*.bak',
      '**/*.current-backup',
    ],
  },

  // ---- Code applicatif (navigateur) --------------------------------------
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Règles de hooks qui comptent vraiment.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Les règles « React Compiler » de react-hooks@7 sont surtout des
      // conseils d'optimisation — informatives, pas bloquantes.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/incompatible-library': 'warn',

      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Variables/args préfixés par _ ignorés (utile en cours de dev).
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // `any` explicite = signalé mais pas bloquant (parsing de JSON IA non typé).
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // ---- Fichiers de config / scripts (Node) ------------------------------
  {
    files: ['*.{js,mjs,cjs}', '.claude/**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Doit rester en dernier : désactive les règles de style qui entrent en
  // conflit avec Prettier.
  prettier,
)
