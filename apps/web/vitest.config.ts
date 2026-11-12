import { defineProject } from "vitest/config";

export default defineProject({
  // O tsconfig usa `jsx: preserve` (quem transforma é o Next); nos testes o Vite transforma o JSX.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { tsconfigPaths: true },
  test: {
    name: "@nexo/web",
    environment: "node",
  },
});
