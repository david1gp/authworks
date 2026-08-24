import * as v from "valibot"
import { userStateSchema } from "../public/userStateSchema.js"
import { userRegistrationVerificationMethodSchema } from "../public/userRegistrationVerificationMethodSchema.js"

export const userCreatedEventPayloadSchema = v.strictObject({
  emailVerified: v.boolean(),
  phoneNumberVerified: v.optional(v.boolean()),
  registrationVerified: v.optional(v.boolean()),
  registrationVerificationMethod: v.optional(v.nullable(userRegistrationVerificationMethodSchema)),
  state: userStateSchema,
})

export type UserCreatedEventPayload = v.InferOutput<typeof userCreatedEventPayloadSchema>
