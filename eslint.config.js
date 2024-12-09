import * as eslintimport from "eslint-plugin-import";

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    {
        languageOptions: {
            parserOptions: {
                project: [
                    "./tsconfig.json",
                    "./test/lib/tsconfig.json",
                    "./scripts/tsconfig.json"
                ],
                tsconfigRootDir: import.meta.dirname,
            },
        },
        plugins: {
            import: eslintimport
        },
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-redundant-type-constituents": "off",
            "@typescript-eslint/ban-ts-comment": "off",
            "@typescript-eslint/no-base-to-string": "off",
            "@typescript-eslint/restrict-template-expressions": "off",
            "@typescript-eslint/unbound-method": "off",
            "@typescript-eslint/no-unnecessary-type-assertion": "off",
            "@typescript-eslint/require-await": "off",
            "@typescript-eslint/no-floating-promises": "off",
            "@typescript-eslint/ban-types": "off",
            "@typescript-eslint/await-thenable": "off",
            "no-constant-condition": "off",
            "no-useless-escape": "off",
            "no-unsafe-optional-chaining": "off",
            "no-extra-semi": "off",
            "prefer-const": "off",
            "import/extensions": [
                "error",
                "ignorePackages",
                {
                    "js": "always"
                }
            ],
            "@typescript-eslint/no-unused-vars": [
                "warn", // or "error"
                {
                    "argsIgnorePattern": "^_",
                    "varsIgnorePattern": "^_",
                    "caughtErrorsIgnorePattern": "^_"
                }
            ]
        }
    }
);