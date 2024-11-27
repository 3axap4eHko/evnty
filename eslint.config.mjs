import prettier from "eslint-plugin-prettier";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [{
    ignores: [
        "**/docs",
        "**/build",
        "**/coverage",
        "**/node_modules",
        "**/scripts",
        "src/*.tmp.ts",
        "src/__tests__/*",
    ],
}, ...compat.extends("eslint-config-airbnb-base").map(config => ({
    ...config,
    files: ["**/*.js"],
})), {
    files: ["**/*.js"],

    plugins: {
        prettier,
    },

    languageOptions: {
        globals: {},
    },

    rules: {
        "prettier/prettier": "error",
    },
}, ...compat.extends(
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
).map(config => ({
    ...config,
    files: ["**/*.ts"],
})), {
    files: ["**/*.ts"],

    plugins: {
        "@typescript-eslint": typescriptEslint,
        prettier,
    },

    languageOptions: {
        globals: {},
        parser: tsParser,
        ecmaVersion: 5,
        sourceType: "script",

        parserOptions: {
            project: "./tsconfig.json",
        },
    },

    rules: {
        "prettier/prettier": "error",
        "@typescript-eslint/no-explicit-any": 0,
        "@typescript-eslint/no-floating-promises": 1,
        "@typescript-eslint/no-unused-vars": 2,
        "@typescript-eslint/no-unsafe-declaration-merging": 0,
        "@typescript-eslint/ban-ts-comment": 1,
        "@typescript-eslint/ban-types": 0,
        "@typescript-eslint/no-empty-object-type": 0
    },
}];
