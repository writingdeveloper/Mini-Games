import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier, // Prettier와 충돌하는 ESLint 규칙 비활성화
  // Flight game uses CesiumJS without type definitions, allow `any`
  {
    files: ["public/flight-game/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
  // Test files - allow unused imports from vitest
  {
    files: ["__tests__/**/*.ts", "e2e/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // Build-free ESM games (served as-is from public/). They lean on runtime globals (BABYLON,
  // THREE/cannon via importmap, browser APIs) so `no-undef` would be noise — but we DO want
  // `no-unused-vars` as a warning so dead code/regressions surface (previously these ~43 files
  // were ignored wholesale and never linted at all).
  {
    files: [
      "public/escape-game/**/*.js",
      "public/survival-game/**/*.js",
      "public/desert-game/**/*.js",
      "public/ppopgi/**/*.js",
      "public/makima-says/**/*.js",
      "public/garak-guksu/**/*.js",
      "public/shared/**/*.js",
    ],
    languageOptions: { sourceType: "module", ecmaVersion: "latest" },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-this-alias": "off", // `const self = this` is intentional in these games
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Only ignore genuinely generated/bundled JS; hand-written game ESM is linted (override above)
    "public/flight-game/game.js", // rewritten by scripts/inject-env.js (Cesium token injection)
    // Server and scripts have their own config
    "server/**",
    "scripts/**",
  ]),
]);

export default eslintConfig;
