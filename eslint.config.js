import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'coverage/', 'data/', 'storage/', 'src/http/public/vendor/'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node } },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }], 'no-irregular-whitespace': ['error', { skipTemplates: true }] },
  },
  { files: ['src/http/public/**/*.js'], languageOptions: { globals: { ...globals.browser, $: 'readonly' } } },
];
