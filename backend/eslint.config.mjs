import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import eslintPluginEslintComments from '@eslint-community/eslint-plugin-eslint-comments';
import eslintStandard from 'eslint-config-love';
import stylistic from '@stylistic/eslint-plugin';

export default tseslint.config(
  {
    ignores: [
      'eslint.config.ts',
      'dist/**/*',
      'node_modules/**/*',
      'coverage/**/*',
      'build/**/*',
      'prisma/client/**/*',
      'generated/**/*',
      '**/*.d.ts',
      '*.config.js',
      '*.config.mjs',
      'test/**/*',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    plugins: {
      ...eslintStandard.plugins,
      ['@eslint-community/eslint-comments']: eslintPluginEslintComments,
      ['@stylistic']: stylistic,
    },
  },
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'module', // Changed to 'module' for NestJS ES modules compatibility
      parserOptions: {
        projectService: true,
        // Explicit root dir so monorepo sibling (frontend) doesn't cause
        // typescript-eslint to complain about multiple candidate roots
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      ...eslintStandard.rules,
      ...eslintPluginEslintComments.configs.recommended.rules,
      '@eslint-community/eslint-comments/require-description': ['error', { ignore: ['eslint-enable'] }],
      '@eslint-community/eslint-comments/disable-enable-pair': 'error',
      '@typescript-eslint/init-declarations': 'off',
      '@typescript-eslint/max-params': ['warn', { max: 15 }],
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/class-methods-use-this': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-magic-numbers': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-unsafe-type-assertion': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/prefer-destructuring': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/restrict-template-expressions': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'off',

      // Add these rules to disable all 'any' related errors
      '@typescript-eslint/no-unsafe-assignment': 'off', //111
      '@typescript-eslint/no-unsafe-member-access': 'off', // 250
      '@typescript-eslint/no-unsafe-call': 'off', //121
      '@typescript-eslint/no-unsafe-return': 'off', //50
      '@typescript-eslint/no-unsafe-argument': 'off', // 41

      '@stylistic/quotes': ['error', 'single'],
      'max-lines': ['warn', { max: 850 }],
      'complexity': ['warn', { max: 15 }],
      'no-console': 'error',
      'no-unneeded-ternary': 'off',
      /* eslint-comments are bundled with eslint-config-love but they are using the unmaintained plugin. Replaced with @eslint-community/eslint-plugin-eslint-comments */
      'eslint-comments/require-description': 'off',
      'eslint-comments/disable-enable-pair': 'off',
      'eslint-comments/no-aggregating-enable': 'off',
      'eslint-comments/no-duplicate-disable': 'off',
      'eslint-comments/no-unlimited-disable': 'off',
      'eslint-comments/no-unused-enable': 'off',
    },
  },
);
