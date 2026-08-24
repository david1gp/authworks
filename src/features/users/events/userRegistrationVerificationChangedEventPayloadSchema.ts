import * as v from "valibot"
import { userRegistrationVerificationMethodSchema } from "../public/userRegistrationVerificationMethodSchema.js"
import { userVerificationStateSchema } from "../public/userVerificationStateSchema.js"

export const userRegistrationVerificationChangedEventPayloadSchema = v.strictObject({
  registrationVerificationMethod: v.optional(v.nullable(userRegistrationVerificationMethodSchema)),
  state: userVerificationStateSchema,
})

export type UserRegistrationVerificationChangedEventPayload = v.InferOutput<
  typeof userRegistrationVerificationChangedEventPayloadSchema
>
