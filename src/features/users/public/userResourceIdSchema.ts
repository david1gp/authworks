import * as v from "valibot"

export const userResourceIdSchema = v.pipe(
  v.union([
    v.pipe(v.string(), v.regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)),
    v.pipe(v.string(), v.regex(/^[1-9][0-9]{0,19}$/)),
  ]),
)

export type UserResourceId = v.InferOutput<typeof userResourceIdSchema>
