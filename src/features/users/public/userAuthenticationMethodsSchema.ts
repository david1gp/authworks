import * as v from "valibot"
import { passkeyCredentialSchema } from "../../passkeys/public/passkeyCredentialSchema.js"

const userAuthenticationMethodsTotpEnrollmentSchema = v.strictObject({
  confirmedAt: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0))),
  id: v.pipe(v.string(), v.minLength(1)),
  label: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  status: v.picklist(["pending", "active"]),
})

const userAuthenticationMethodsTotpSchema = v.strictObject({
  enrolled: v.boolean(),
  enrollments: v.array(userAuthenticationMethodsTotpEnrollmentSchema),
})

const userAuthenticationMethodsRecoveryCodesSchema = v.strictObject({
  available: v.boolean(),
  generatedAt: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0))),
  remaining: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

const userAuthenticationMethodsEmailOtpSchema = v.strictObject({
  available: v.boolean(),
})

const userAuthenticationMethodsPasskeysSchema = v.strictObject({
  credentials: v.array(passkeyCredentialSchema),
})

export const userAuthenticationMethodsSchema = v.strictObject({
  emailOtp: userAuthenticationMethodsEmailOtpSchema,
  passkeys: userAuthenticationMethodsPasskeysSchema,
  recoveryCodes: userAuthenticationMethodsRecoveryCodesSchema,
  totp: userAuthenticationMethodsTotpSchema,
})

export type UserAuthenticationMethods = v.InferOutput<typeof userAuthenticationMethodsSchema>
