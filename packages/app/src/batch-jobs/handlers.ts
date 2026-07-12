import {
  type BatchJobType,
  UPPERCASE_BATCH_ITEM_INPUT_SCHEMA,
  UPPERCASE_BATCH_ITEM_OUTPUT_SCHEMA
} from "@saasweave/core/batch-jobs/types";

const ITEM_PROCESS_MAX_ATTEMPTS = 3;

export { ITEM_PROCESS_MAX_ATTEMPTS };

export function processBatchItem(type: BatchJobType, input: unknown): unknown {
  switch (type) {
    case "uppercase": {
      const parsed = UPPERCASE_BATCH_ITEM_INPUT_SCHEMA.parse(input);
      const output = UPPERCASE_BATCH_ITEM_OUTPUT_SCHEMA.parse({
        text: parsed.text.toUpperCase()
      });
      return output;
    }
    default:
      throw new Error("Unsupported batch job type");
  }
}
