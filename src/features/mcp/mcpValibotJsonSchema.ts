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
  readonly key?: unknown
  readonly value?: unknown
  readonly items?: readonly unknown[]
  readonly rest?: unknown
  readonly literal?: unknown
  readonly getter?: unknown
}

const valibotJsonSchemaMaxDepth = 10

function valibotInternalsGet(schema: v.GenericSchema<unknown>): ValibotInternals {
  return schema as unknown as ValibotInternals
}

function valibotOptionalIs(schema: v.GenericSchema<unknown>): boolean {
  const type = valibotInternalsGet(schema).type
  return type === "optional" || type === "nullish"
}

function literalJsonTypeGet(value: unknown): string | undefined {
  if (typeof value === "string") return "string"
  if (typeof value === "boolean") return "boolean"
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number"
  if (value === null) return "null"
  return undefined
}

function picklistJsonSchemaCreate(options: readonly unknown[]): McpJsonSchema {
  const types = options.map((option) => literalJsonTypeGet(option))
  const first = types[0]
  if (first !== undefined && types.every((type) => type === first)) return { enum: [...options], type: first }
  return { enum: [...options] }
}

function valibotInnerConvert(schema: v.GenericSchema<unknown>, depth: number): McpJsonSchema {
  if (depth > valibotJsonSchemaMaxDepth) return {}
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
    case "date": {
      return { format: "date-time", type: "string" }
    }
    case "literal": {
      const literalType = literalJsonTypeGet(internals.literal)
      if (literalType === undefined) {
        if (internals.literal === undefined) return {}
        return { const: internals.literal }
      }
      return { const: internals.literal, type: literalType }
    }
    case "picklist": {
      return picklistJsonSchemaCreate((internals.options ?? []) as readonly unknown[])
    }
    case "enum": {
      return picklistJsonSchemaCreate((internals.options ?? []) as readonly unknown[])
    }
    case "optional":
    case "nullish": {
      return valibotInnerConvert(internals.wrapped as v.GenericSchema<unknown>, depth + 1)
    }
    case "nullable": {
      const wrapped = valibotInnerConvert(internals.wrapped as v.GenericSchema<unknown>, depth + 1)
      if (Array.isArray(wrapped.type)) return { ...wrapped, type: [...(wrapped.type as string[]), "null"] }
      if (Array.isArray(wrapped.anyOf)) return { anyOf: [...(wrapped.anyOf as McpJsonSchema[]), { type: "null" }] }
      if (typeof wrapped.type === "string") return { ...wrapped, type: [wrapped.type, "null"] }
      return { anyOf: [wrapped, { type: "null" }] }
    }
    case "null": {
      return { type: "null" }
    }
    case "union":
    case "variant": {
      const options = (internals.options ?? []) as readonly v.GenericSchema<unknown>[]
      return { oneOf: options.map((option) => valibotInnerConvert(option, depth + 1)) }
    }
    case "intersect": {
      const options = (internals.options ?? []) as readonly v.GenericSchema<unknown>[]
      return { allOf: options.map((option) => valibotInnerConvert(option, depth + 1)) }
    }
    case "object":
    case "strict_object":
    case "loose_object": {
      const entries = (internals.entries ?? {}) as Record<string, v.GenericSchema<unknown>>
      const properties: Record<string, McpJsonSchema> = {}
      const required: string[] = []
      for (const [key, entry] of Object.entries(entries)) {
        properties[key] = valibotInnerConvert(entry, depth + 1)
        if (!valibotOptionalIs(entry)) required.push(key)
      }
      const result: McpJsonSchema = { properties, type: "object" }
      if (required.length > 0) result.required = required
      return result
    }
    case "record": {
      if (internals.value === undefined || internals.value === null) return { type: "object" }
      return {
        additionalProperties: valibotInnerConvert(internals.value as v.GenericSchema<unknown>, depth + 1),
        type: "object",
      }
    }
    case "array": {
      return { items: valibotInnerConvert(internals.item as v.GenericSchema<unknown>, depth + 1), type: "array" }
    }
    case "tuple":
    case "loose_tuple":
    case "strict_tuple": {
      const items = ((internals.items ?? []) as readonly v.GenericSchema<unknown>[]).map((item) =>
        valibotInnerConvert(item, depth + 1),
      )
      return { maxItems: items.length, minItems: items.length, prefixItems: items, type: "array" }
    }
    case "tuple_with_rest": {
      const items = ((internals.items ?? []) as readonly v.GenericSchema<unknown>[]).map((item) =>
        valibotInnerConvert(item, depth + 1),
      )
      return {
        items: valibotInnerConvert(internals.rest as v.GenericSchema<unknown>, depth + 1),
        minItems: items.length,
        prefixItems: items,
        type: "array",
      }
    }
    case "lazy": {
      if (typeof internals.getter !== "function") return {}
      try {
        return valibotInnerConvert((internals.getter as () => v.GenericSchema<unknown>)(), depth + 1)
      } catch {
        return {}
      }
    }
    default: {
      return {}
    }
  }
}

export function valibotToJsonSchema(schema: v.GenericSchema<unknown>): McpJsonSchema {
  const converted = valibotInnerConvert(schema, 0)
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
