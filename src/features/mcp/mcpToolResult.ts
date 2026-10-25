import type { McpToolResult } from "./mcpToolRegistry.js"

export function mcpToolResult(result: unknown, isError = false): McpToolResult {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result) }],
    ...(isError ? { isError: true as const } : {}),
  }
}
