import * as v from "valibot"
import { userVerificationStateSchema } from "../domain/userVerificationStateSchema.js"

export const userEmailVerificationChangedEventPayloadSchema = v.strictObject({
  state: userVerificationStateSchema,
})

export type UserEmailVerificationChangedEventPayload = v.InferOutput<
  typeof userEmailVerificationChangedEventPayloadSchema
>
