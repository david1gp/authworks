import * as v from "valibot"

export const passwordChangeResponseSchema = v.strictObject({
  changed: v.literal(true),
})

export type PasswordChangeResponse = v.InferOutput<typeof passwordChangeResponseSchema>
