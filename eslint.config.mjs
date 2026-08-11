import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import jest from 'eslint-plugin-jest'
import prettier from 'eslint-plugin-prettier/recommended'
import tseslint from 'typescript-eslint'

// `eslint-plugin-react` is deliberately absent: it still calls APIs that ESLint
// 10 removed, and its rules target component conventions this package doesn't
// ship. `eslint-plugin-react-hooks` covers the rules that matter here.
export default tseslint.config(
  { ignores: ['lib/**', 'node_modules/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  prettier,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: { ecmaFeatures: { jsx: true } }
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      'react-hooks/rules-of-hooks': 'error',
      // `useDerivedState` takes a dependency list just like `useMemo`, so hold
      // it to the same standard — in this repo and, via the README, in apps.
      'react-hooks/exhaustive-deps': [
        'error',
        { additionalHooks: '(useDerivedState)' }
      ]
    }
  },
  {
    // The React Compiler rules describe how *application* components should
    // behave. A store implementation sits on the other side of that contract:
    // it owns a mutable subscription registry and has to reconcile it while
    // rendering, which is exactly what these rules exist to prevent elsewhere.
    files: ['src/create-store.ts'],
    rules: {
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-render': 'off',
      'react-hooks/immutability': 'off'
    }
  },
  {
    files: ['src/**/*.test.@(ts|tsx)'],
    ...jest.configs['flat/recommended']
  },
  {
    files: ['**/*.mjs', '**/*.js'],
    languageOptions: {
      globals: globals.node,
      sourceType: 'commonjs'
    }
  },
  {
    files: ['**/*.mjs'],
    languageOptions: { sourceType: 'module' }
  }
)
