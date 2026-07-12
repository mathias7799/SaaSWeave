export const UNATTRIBUTED_USAGE_LABEL = "Unattributed";

/** Map nullable token columns to input/output totals for one usage row. */
export function usageEventTokenSplit(
  inputTokens: number | null,
  outputTokens: number | null,
  quantity: number
): { inputTokens: number; outputTokens: number; totalTokens: number } {
  const resolvedInput = inputTokens ?? (outputTokens === null ? quantity : 0);
  const resolvedOutput = outputTokens ?? 0;
  return {
    inputTokens: resolvedInput,
    outputTokens: resolvedOutput,
    totalTokens: resolvedInput + resolvedOutput
  };
}
