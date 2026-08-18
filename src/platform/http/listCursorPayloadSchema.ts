import * as v from "valibot"

export const listCursorPayloadSchema = v.strictObject({
  v: v.literal(1),
  id: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  k: v.union([v.string(), v.number()]),
})
