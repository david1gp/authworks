import * as v from "valibot"

export type McpJsonSchema = Record<string, unknown>

type ValibotInternals = {
  readonly type?: string
  readonly pipe?: readonly { readonly type?: string; readonly requirement?: unknown }[]
  readonly options?: readonly unknown[]
  readonly enum?: Record<string, string>
  readonly wrapped?: unknown
  readonly entries?: Record<string, unknown>
  readonly item?: unknown
  readonly literal?: unknown
}

function valibotInternalsGet(schema: v.GenericSchema<unknown>): ValibotInternals {
  return schema as unknown as ValibotInternals
}

function valibotOptionalIs(schema: v.GenericSchema<unknown>): boolean {
  return valibotInternalsGet(schema).type === "optional"
}

function valibotInnerConvert(schema: v.GenericSchema<unknown>): McpJsonSchema {
  const internals = valibotInternalsGet(schema)
  switch (internals.type) {
    case "string": {
      return { type: "string" }
    }
    case "number": {
      let integer = false
      const result: McpJsonSchema = { type: "number" }
      for (const pipe of internals.pipe ?? []) {
        if (pipe.type === "integer") {
          integer = true
          result.maximum = 9007199254740991
        }
        if ((pipe.type === "min_value" || pipe.type === "minimum") && typeof pipe.requirement === "number")
          result.minimum = pipe.requirement
        if ((pipe.type === "max_value" || pipe.type === "maximum") && typeof pipe.requirement === "number")
          result.maximum = pipe.requirement
      }
      if (integer) result.type = "integer"
      return result
    }
    case "boolean": {
      return { type: "boolean" }
    }
    case "literal": {
      return { type: "string", const: internals.literal }
    }
    case "picklist": {
      return { type: "string", enum: [...((internals.options ?? []) as readonly unknown[])] }
    }
    case "enum": {
      return { type: "string", enum: [...Object.values(internals.enum ?? {})] }
    }
    case "optional": {
      return valibotInnerConvert(internals.wrapped as v.GenericSchema<unknown>)
    }
    case "nullable": {
      const wrapped = valibotInnerConvert(internals.wrapped as v.GenericSchema<unknown>)
      if (Array.isArray(wrapped.type)) return { ...wrapped, type: [...(wrapped.type as string[]), "null"] }
      if (Array.isArray(wrapped.anyOf)) return { anyOf: [...(wrapped.anyOf as McpJsonSchema[]), { type: "null" }] }
      if (typeof wrapped.type === "string") return { ...wrapped, type: [wrapped.type, "null"] }
      return { anyOf: [wrapped, { type: "null" }] }
    }
    case "union":
    case "variant": {
      const options = (internals.options ?? []) as readonly v.GenericSchema<unknown>[]
      return { oneOf: options.map((option) => valibotInnerConvert(option)) }
    }
    case "object": {
      const entries = (internals.entries ?? {}) as Record<string, v.GenericSchema<unknown>>
      const properties: Record<string, McpJsonSchema> = {}
      const required: string[] = []
      for (const [key, entry] of Object.entries(entries)) {
        properties[key] = valibotInnerConvert(entry)
        if (!valibotOptionalIs(entry)) required.push(key)
      }
      const result: McpJsonSchema = { type: "object", properties }
      if (required.length > 0) result.required = required
      return result
    }
    case "array": {
      return { type: "array", items: valibotInnerConvert(internals.item as v.GenericSchema<unknown>) }
    }
    default: {
      return {}
    }
  }
}

export function valibotToJsonSchema(schema: v.GenericSchema<unknown>): McpJsonSchema {
  const converted = valibotInnerConvert(schema)
  if (
    converted.type === "object" &&
    converted.properties !== undefined &&
    Object.keys(converted.properties as Record<string, unknown>).length === 0 &&
    converted.required === undefined
  ) {
    return converted
  }
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    ...converted,
  }
}
