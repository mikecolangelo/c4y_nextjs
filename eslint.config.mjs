import { createRequire } from "node:module";
import { defineConfig, globalIgnores } from "eslint/config";

// eslint-config-next@14 only ships eslintrc-style configs, so they must be
// loaded through FlatCompat. @eslint/eslintrc is not hoisted by pnpm, so it
// is resolved through eslint's own dependency tree.
const require = createRequire(import.meta.url);
const requireFromEslint = createRequire(require.resolve("eslint/package.json"));
const { FlatCompat } = requireFromEslint("@eslint/eslintrc");

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // @next/eslint-plugin-next@14 implements this rule with an API removed
      // in ESLint 9 (context.getAncestors), so it crashes. The rule only
      // applies to pages/_document, which this App Router project does not use.
      "@next/next/no-duplicate-head": "off",
      // Keep the severities these rules had in the @typescript-eslint v5 era
      // that eslint-config-next@14 was built for (v8 promoted them to error,
      // which surfaces 550+ pre-existing issues). Kept visible as warnings.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Committed build artifact snapshot, not source code.
    ".next-prod-deploy.broken.20260508_221203/**",
  ]),
]);

export default eslintConfig;
