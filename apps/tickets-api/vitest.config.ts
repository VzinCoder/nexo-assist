import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@nexo/tickets-api",
    environment: "node",
  },
});
