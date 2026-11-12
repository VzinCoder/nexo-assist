import { defineConfig } from "tsup";

export default defineConfig({
  entry: { server: "src/server.ts" },
  format: ["esm"],
  platform: "node",
  target: "node24",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  // Pacotes internos exportam TypeScript; precisam ir para dentro do bundle.
  noExternal: [/^@nexo\//],
  // `node:sqlite` só existe com o prefixo; o padrão do tsup o removeria.
  removeNodeProtocol: false,
});
