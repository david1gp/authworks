import * as v from "valibot"

export const userEmailAddressAddVerifyRequestSchema = v.strictObject({
  challengeId: v.pipe(v.string(), v.minLength(1)),
  token: v.pipe(v.string(), v.minLength(32), v.maxLength(256)),
})

export type UserEmailAddressAddVerifyRequest = v.InferOutput<typeof userEmailAddressAddVerifyRequestSchema>
