import { describe, expect, it } from "vite-plus/test";

import { cn } from "@saasweave/ui/lib/utils";

describe("@saasweave/ui primitives", () => {
  it("merges class names with tailwind precedence", () => {
    const hidden = false as boolean;
    expect(cn("px-2", hidden && "hidden", "px-4")).toBe("px-4");
  });

  it("treats conditional classes as absent when falsy", () => {
    expect(cn("text-sm", undefined, null, "font-medium")).toBe("text-sm font-medium");
  });
});
