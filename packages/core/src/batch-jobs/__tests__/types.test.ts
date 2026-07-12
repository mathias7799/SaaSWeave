import { describe, expect, it } from "vite-plus/test";

import {
  BATCH_JOB_TYPES,
  BatchJobTypeSchema,
  UPPERCASE_BATCH_ITEM_INPUT_SCHEMA,
  UPPERCASE_BATCH_ITEM_OUTPUT_SCHEMA
} from "#@/batch-jobs/types";

describe("BATCH_JOB_TYPES", () => {
  it("ships the uppercase demo processor", () => {
    expect(BATCH_JOB_TYPES).toEqual(["uppercase"]);
  });
});

describe("BatchJobTypeSchema", () => {
  it("accepts supported job types", () => {
    expect(BatchJobTypeSchema.safeParse("uppercase").success).toBe(true);
  });

  it("rejects unknown job types", () => {
    expect(BatchJobTypeSchema.safeParse("summarize").success).toBe(false);
  });
});

describe("UPPERCASE_BATCH_ITEM_INPUT_SCHEMA", () => {
  it("accepts non-empty text within the size limit", () => {
    expect(UPPERCASE_BATCH_ITEM_INPUT_SCHEMA.safeParse({ text: "hello" }).success).toBe(true);
  });

  it("rejects empty or oversized text", () => {
    expect(UPPERCASE_BATCH_ITEM_INPUT_SCHEMA.safeParse({ text: "" }).success).toBe(false);
    expect(UPPERCASE_BATCH_ITEM_INPUT_SCHEMA.safeParse({ text: "a".repeat(10_001) }).success).toBe(
      false
    );
  });
});

describe("UPPERCASE_BATCH_ITEM_OUTPUT_SCHEMA", () => {
  it("accepts transformed text output", () => {
    expect(UPPERCASE_BATCH_ITEM_OUTPUT_SCHEMA.safeParse({ text: "HELLO" }).success).toBe(true);
  });

  it("rejects missing text", () => {
    expect(UPPERCASE_BATCH_ITEM_OUTPUT_SCHEMA.safeParse({}).success).toBe(false);
  });
});
