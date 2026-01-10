import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier, // Prettier와 충돌하는 ESLint 규칙 비활성화
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
  ]),
]);

export default eslintConfig;
