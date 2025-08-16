import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';
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
    ],
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
      sourceType: 'module', // Changed to 'module' for NestJS ES modules compatibility
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // Allow 'any' for flexibility in NestJS/Prisma
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/unbound-method': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      // From reference: stylistic rules for consistency
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      // From reference: enforce single quotes (common in NestJS)
      'quotes': ['error', 'single'],
      // From reference: complexity limits
      'complexity': ['warn', { max: 25 }],
      'max-depth': ['warn', { max: 5 }],
      'no-console': 'warn', // Changed to warn for NestJS logging
    },
  },
);
