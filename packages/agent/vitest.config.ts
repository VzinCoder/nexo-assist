import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@nexo/agent",
    environment: "node",
  },
});
