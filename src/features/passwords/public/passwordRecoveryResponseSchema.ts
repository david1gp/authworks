import * as v from "valibot"

export const passwordRecoveryResponseSchema = v.strictObject({
  accepted: v.literal(true),
})

export type PasswordRecoveryResponse = v.InferOutput<typeof passwordRecoveryResponseSchema>
