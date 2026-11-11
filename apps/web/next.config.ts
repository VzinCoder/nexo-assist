import type { NextConfig } from "next";
// Importado aqui para validar o ambiente já no `next dev`/`next build`.
import "./src/env";

const nextConfig: NextConfig = {
  transpilePackages: ["@nexo/shared", "@nexo/agent"],
};

export default nextConfig;
