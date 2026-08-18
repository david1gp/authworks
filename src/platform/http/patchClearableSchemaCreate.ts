import * as v from "valibot"

export function patchClearableSchemaCreate<TSchema extends v.GenericSchema>(valueSchema: TSchema) {
  return v.optional(v.nullable(valueSchema))
}
