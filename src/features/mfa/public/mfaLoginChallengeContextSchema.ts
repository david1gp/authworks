import * as v from "valibot"
import { mfaFactorSchema } from "./mfaFactorSchema.js"

export const mfaLoginChallengeContextSchema = v.strictObject({
  availableFactors: v.array(mfaFactorSchema),
  challengeId: v.pipe(v.string(), v.minLength(1)),
  expiresAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  factor: mfaFactorSchema,
  organizationId: v.optional(v.pipe(v.string(), v.minLength(1))),
  primaryAuthenticationMethod: v.picklist(["email_otp", "external_identity", "password", "passkey", "whatsapp_otp"]),
  purpose: v.picklist(["login", "step_up"]),
  realmId: v.pipe(v.string(), v.minLength(1)),
  userId: v.pipe(v.string(), v.minLength(1)),
})

export type MfaLoginChallengeContext = v.InferOutput<typeof mfaLoginChallengeContextSchema>
