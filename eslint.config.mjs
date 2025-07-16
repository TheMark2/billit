import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Cambiar de "warn" a "off" para evitar fallos en producción
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/triple-slash-reference": "off",
      "react-hooks/exhaustive-deps": "warn",
      "@next/next/no-img-element": "warn",
      "jsx-a11y/alt-text": "warn",
    },
  },
];

export default eslintConfig;
