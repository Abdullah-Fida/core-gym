import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

// The frontend (browser, ESM, JSX) and the backend (Node, CommonJS) are two
// different environments. Linting both with `globals.browser` produced 183
// bogus `no-undef` errors for `require`, `module` and `process` — over half of
// every problem reported — which buried the real ones.
export default defineConfig([
  globalIgnores(['dist', 'dev-dist', 'node_modules', 'backend/node_modules']),

  // ── Frontend: src/ ────────────────────────────────
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      // Core no-undef cannot see JSX element names — `<Nope />` creates a
      // JSXIdentifier, not an Identifier reference — so an unimported component
      // linted clean and only failed at runtime. jsx-no-undef closes that.
      react.configs.flat.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    settings: { react: { version: 'detect' } },
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': [
        'error',
        {
          // Capitalised names are JSX components; the react plugin marks them
          // used, so these patterns only need to cover genuine constants.
          varsIgnorePattern: '^[A-Z_]',
          argsIgnorePattern: '^[A-Z_]',
          // `catch (err) {}` where the error is deliberately swallowed is a
          // legitimate pattern; requiring a rename to `_err` adds noise.
          caughtErrors: 'none',
        },
      ],

      // This project does not use PropTypes; types are not enforced at runtime.
      'react/prop-types': 'off',
      // The automatic JSX runtime means React need not be in scope.
      'react/react-in-jsx-scope': 'off',
      // Deliberate: several components render server-provided strings that may
      // legitimately contain apostrophes.
      'react/no-unescaped-entities': 'off',
    },
  },

  // ── Context providers ─────────────────────────────
  // Each of these exports a Provider *and* its `useX()` hook, which is the
  // conventional shape. react-refresh only warns because that costs the file
  // its fast-refresh boundary in dev — it is not a correctness problem.
  // The same applies to the UI primitives, which export a component plus the
  // small constant map that defines its variants.
  {
    files: ['src/contexts/**/*.jsx', 'src/components/ui/**/*.jsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // ── Build/config files at the repo root (Node, ESM) ──
  {
    files: ['*.config.js', 'vite.config.js', 'eslint.config.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.node,
      parserOptions: { sourceType: 'module' },
    },
  },

  // ── Backend: Node + CommonJS ──────────────────────
  {
    files: ['backend/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: { ...globals.node, ...globals.jest },
      sourceType: 'commonjs',
    },
    rules: {
      'no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
    },
  },
])
