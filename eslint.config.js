import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // Enabled as "warn" rather than "error" on purpose. There are 119
      // existing findings; making them errors would bury them among the 174
      // pre-existing errors and imply the code is broken rather than untidy.
      // As warnings they are a distinct, countable backlog. Promote to "error"
      // once the count reaches zero, at which point lint can also join the CI
      // gate (see .github/workflows/ci.yml).
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
);
