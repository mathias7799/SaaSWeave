import { describe, expect, it } from "vite-plus/test";

import { stripSecretFields } from "@saasweave/app/data-export/strip-secrets";

describe("stripSecretFields contract", () => {
  it("removes known secret keys recursively", () => {
    const input = {
      name: "visible",
      nested: { keyHash: "hidden", token: "hidden", keep: "ok" },
      secret: "hidden"
    };

    expect(stripSecretFields(input)).toEqual({
      name: "visible",
      nested: { keep: "ok" }
    });
  });

  it("preserves nullish values, primitives, and array shape", () => {
    expect(stripSecretFields(null)).toBeNull();
    expect(stripSecretFields(undefined)).toBeUndefined();
    expect(stripSecretFields("visible")).toBe("visible");
    expect(stripSecretFields([1, { password: "hidden", value: 2 }])).toEqual([1, { value: 2 }]);
  });
});
