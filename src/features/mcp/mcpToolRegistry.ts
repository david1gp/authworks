import * as v from "valibot"
import type { McpJsonSchema } from "./mcpValibotJsonSchema.js"
import { valibotToJsonSchema } from "./mcpValibotJsonSchema.js"

export type McpToolResult = {
  readonly content: readonly [{ readonly type: "text"; readonly text: string }]
  readonly isError?: true
}

export type McpToolDefinition = {
  readonly name: string
  readonly description: string
  readonly inputSchema: v.GenericSchema<unknown>
  readonly run: (args: Record<string, unknown>) => Promise<McpToolResult>
}

export type McpToolRegistration = {
  readonly name: string
  readonly description: string
  readonly inputJsonSchema: McpJsonSchema
  readonly inputSchema: v.GenericSchema<unknown>
}

export type McpToolRegistry = {
  readonly definitions: readonly McpToolDefinition[]
  readonly registrations: readonly McpToolRegistration[]
  readonly call: (name: string, args: unknown) => Promise<McpToolResult>
}

export function mcpToolRegistryCreate(definitions: readonly McpToolDefinition[]): McpToolRegistry {
  const registrations = definitions.map((definition) => ({
    name: definition.name,
    description: definition.description,
    inputJsonSchema: valibotToJsonSchema(definition.inputSchema),
    inputSchema: definition.inputSchema,
  }))
  return {
    definitions,
    registrations,
    call: (name, args) => mcpToolCall(definitions, name, args),
  }
}

async function mcpToolCall(
  definitions: readonly McpToolDefinition[],
  name: string,
  args: unknown,
): Promise<McpToolResult> {
  const definition = definitions.find((candidate) => candidate.name === name)
  if (definition === undefined)
    return { content: [{ type: "text", text: `MCP error -32602: Tool ${name} not found` }], isError: true }
  const parsed = v.safeParse(definition.inputSchema, args ?? {})
  if (!parsed.success)
    return {
      content: [
        { type: "text", text: `MCP error -32602: Invalid arguments for tool ${name}: ${v.summarize(parsed.issues)}` },
      ],
      isError: true,
    }
  try {
    return await definition.run(parsed.output as Record<string, unknown>)
  } catch (error) {
    return {
      content: [{ type: "text", text: `MCP error -32603: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    }
  }
}
