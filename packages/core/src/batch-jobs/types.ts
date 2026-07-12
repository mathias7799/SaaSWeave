import { z } from "zod";

/** Demo batch job types supported by the platform processor. */
export const BATCH_JOB_TYPES = ["uppercase"] as const;

export const BatchJobTypeSchema = z.enum(BATCH_JOB_TYPES);

export type BatchJobType = z.infer<typeof BatchJobTypeSchema>;

export const UPPERCASE_BATCH_ITEM_INPUT_SCHEMA = z.object({
  text: z.string().min(1).max(10_000)
});

export type UppercaseBatchItemInput = z.infer<typeof UPPERCASE_BATCH_ITEM_INPUT_SCHEMA>;

export const UPPERCASE_BATCH_ITEM_OUTPUT_SCHEMA = z.object({
  text: z.string()
});

export type UppercaseBatchItemOutput = z.infer<typeof UPPERCASE_BATCH_ITEM_OUTPUT_SCHEMA>;
