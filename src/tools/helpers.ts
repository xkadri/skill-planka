import { CHARACTER_LIMIT } from "../constants.js";
import { PlankaApiError } from "../services/plankaClient.js";

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

/** Wrap a JSON-serializable value as a tool result, truncating oversized payloads. */
export function jsonResult(data: unknown): ToolResult {
  let text = JSON.stringify(data, null, 2);
  let structuredContent: Record<string, unknown> | undefined =
    data && typeof data === "object" ? (data as Record<string, unknown>) : undefined;

  if (text.length > CHARACTER_LIMIT) {
    text =
      text.slice(0, CHARACTER_LIMIT) +
      `\n... [truncated, ${text.length} total characters. Narrow your query or use pagination.]`;
    structuredContent = undefined;
  }

  return { content: [{ type: "text", text }], structuredContent };
}

export function errorResult(message: string): ToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

/** Run a tool handler, converting PlankaApiError / unexpected errors into a tool-level error result. */
export async function runTool(fn: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof PlankaApiError) {
      return errorResult(error.message);
    }
    return errorResult(`Error: Unexpected error occurred: ${error instanceof Error ? error.message : String(error)}`);
  }
}
