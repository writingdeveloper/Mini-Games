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
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Game files - only ignore compiled JS, lint TypeScript source
    "public/escape-game/**",
    "public/survival-game/*.js",
    "public/survival-game/game-modular.js",
    "public/survival-game/assets/**",
    "public/survival-game/src/**",
    "public/shared/**",
    "public/flight-game/game.js",
    // Server and scripts have their own config
    "server/**",
    "scripts/**",
  ]),
]);

export default eslintConfig;
