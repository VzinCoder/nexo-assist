import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@nexo/shared",
    environment: "node",
  },
});
