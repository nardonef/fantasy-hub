import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Allow any for Prisma workarounds (documented in tsconfig)
      "@typescript-eslint/no-explicit-any": "off",
      // Unused vars are errors except for _ prefix
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // Allow require() in scripts
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    ignores: ["dist/", "node_modules/", "src/generated/"],
  }
);
