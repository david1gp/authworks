import * as v from "valibot"

export function listResponseSchemaCreate<const TSchema extends v.GenericSchema>(itemSchema: TSchema) {
  return v.strictObject({
    items: v.array(itemSchema),
    nextPageToken: v.optional(v.pipe(v.string(), v.minLength(1))),
  })
}
