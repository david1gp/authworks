import * as v from "valibot"

export const passwordRecoveryCompleteResponseSchema = v.strictObject({
  changed: v.literal(true),
})

export type PasswordRecoveryCompleteResponse = v.InferOutput<typeof passwordRecoveryCompleteResponseSchema>
