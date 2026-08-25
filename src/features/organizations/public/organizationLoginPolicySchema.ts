import * as v from "valibot"

const organizationLoginPolicyProviderIdSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(128))
const organizationLoginPolicySessionLifetimeSecondsSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(1),
  v.maxValue(365 * 24 * 60 * 60),
)

export const organizationLoginPolicySchema = v.strictObject({
  allowDomainDiscovery: v.boolean(),
  allowEmailOtp: v.boolean(),
  allowWhatsappOtp: v.optional(v.boolean()),
  allowExternalIdentity: v.boolean(),
  allowPassword: v.boolean(),
  allowPasswordRecovery: v.boolean(),
  allowPasskey: v.boolean(),
  allowRegistration: v.boolean(),
  providerIds: v.nullable(v.array(organizationLoginPolicyProviderIdSchema)),
  sessionLifetimeSeconds: v.optional(organizationLoginPolicySessionLifetimeSecondsSchema),
})

export type OrganizationLoginPolicy = v.InferOutput<typeof organizationLoginPolicySchema>
