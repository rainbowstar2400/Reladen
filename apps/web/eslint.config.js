import js from '@eslint/js';
import next from 'eslint-config-next';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';
import unusedImports from 'eslint-plugin-unused-imports';

export default tseslint.config(
  {
    ignores: ['.next/**', 'dist/**', 'public/sw.js'],
  },
  js.configs.recommended,
  ...next,
  prettier,
  {
    rules: {
      'unused-imports/no-unused-imports': 'error',
    },
    plugins: {
      'unused-imports': unusedImports,
    },
  }
);
