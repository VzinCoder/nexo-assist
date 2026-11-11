import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@nexo/web",
    environment: "node",
  },
});
