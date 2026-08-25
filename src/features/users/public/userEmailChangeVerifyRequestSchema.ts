import * as v from "valibot"

export const userEmailChangeVerifyRequestSchema = v.strictObject({
  challengeId: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  token: v.pipe(v.string(), v.minLength(32), v.maxLength(256)),
})

export type UserEmailChangeVerifyRequest = v.InferOutput<typeof userEmailChangeVerifyRequestSchema>
