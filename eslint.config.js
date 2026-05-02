import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: [
      '.next/**',
      'dist/**',
      'node_modules/**',
      'python-analysis/**',
      'public/**',
      'next-env.d.ts',
      '**/*.ts',
      '**/*.tsx',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.jsx'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['app/**/*.js', '**/*.jsx'],
    rules: {
      'no-unused-vars': 'off',
    },
  },
  {
    files: ['app/**/route.js', 'lib/**/*.js', 'middleware.js', 'next.config.js', 'postcss.config.js', 'tailwind.config.js'],
    rules: {
      'no-unused-vars': 'error',
    },
  },
];
