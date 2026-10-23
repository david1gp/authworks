import * as v from "valibot"

export const passwordSetRequestSchema = v.strictObject({
  password: v.pipe(v.string(), v.minLength(1), v.maxLength(1024)),
})

export type PasswordSetRequest = v.InferOutput<typeof passwordSetRequestSchema>
