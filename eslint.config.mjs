// Lints the build scripts and tests. The TypeScript app is checked by tsc
// (npm run typecheck) with strict settings, including unused code.
import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["dist/**", "node_modules/**", "src/**", "test-results/**", "playwright-report/**"] },
  js.configs.recommended,
  {
    files: ["**/*.mjs"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: { ...globals.node } },
    rules: { "no-unused-vars": ["error", { argsIgnorePattern: "^_" }] },
  },
  {
    files: ["tests/e2e/**/*.mjs", "scripts/screenshots.mjs"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
