import { describe, expect, it } from "vitest";
import { PRODUCT_NAME } from "./index";

describe("@nexo/shared", () => {
  it("exporta o nome do produto", () => {
    expect(PRODUCT_NAME).toBe("Nexo Assist");
  });
});
