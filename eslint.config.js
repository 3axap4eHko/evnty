import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import { globalIgnores } from "eslint/config";
import prettier from "eslint-plugin-prettier";

export default tseslint.config(
  globalIgnores(["src/__tests__/*"]),
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    files: ["**/*.ts"],
    ignores: [
      "**/docs",
      "**/build",
      "**/coverage",
      "**/node_modules",
      "**/scripts",
      "**/*.tmp.ts",
      "**/__tests__/*",
    ],
    plugins: {
      prettier,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "prettier/prettier": 2,
      "@typescript-eslint/no-explicit-any": 0,
      "@typescript-eslint/no-floating-promises": 1,
      "@typescript-eslint/no-unused-vars": 2,
      "@typescript-eslint/no-unsafe-declaration-merging": 0,
      "@typescript-eslint/ban-ts-comment": 1,
      "@typescript-eslint/ban-types": 0,
      "@typescript-eslint/prefer-promise-reject-errors": 0,
      "@typescript-eslint/no-empty-object-type": 0
    },
  },
);
