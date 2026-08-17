import * as v from "valibot"

export const impersonationEndResponseSchema = v.strictObject({
  ended: v.boolean(),
  sessionId: v.pipe(v.string(), v.minLength(1)),
})

export type ImpersonationEndResponse = v.InferOutput<typeof impersonationEndResponseSchema>
