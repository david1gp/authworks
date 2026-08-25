import * as v from "valibot"
import { userRegistrationVerificationMethodSchema } from "../public/userRegistrationVerificationMethodSchema.js"
import { userStateSchema } from "../public/userStateSchema.js"

export const userCreatedEventPayloadSchema = v.strictObject({
  emailVerified: v.boolean(),
  phoneNumberVerified: v.optional(v.boolean()),
  registrationVerified: v.optional(v.boolean()),
  registrationVerificationMethod: v.optional(v.nullable(userRegistrationVerificationMethodSchema)),
  state: userStateSchema,
})

export type UserCreatedEventPayload = v.InferOutput<typeof userCreatedEventPayloadSchema>
