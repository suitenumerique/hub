import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import playwright from 'eslint-plugin-playwright';

export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
      playwright,
    },
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'playwright/no-force-option': 'off',
      'playwright/no-wait-for-timeout': 'off',
      'playwright/no-conditional-in-test': 'off',
      'playwright/no-skipped-test': 'off',
      'playwright/expect-expect': 'error',
      'playwright/no-conditional-expect': 'error',
    },
  },
];
