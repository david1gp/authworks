import * as v from "valibot"

const organizationLoginPolicyProviderIdSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(128))

export const organizationLoginPolicySchema = v.strictObject({
  allowDomainDiscovery: v.boolean(),
  allowEmailOtp: v.boolean(),
  allowExternalIdentity: v.boolean(),
  allowPassword: v.boolean(),
  allowPasswordRecovery: v.boolean(),
  allowPasskey: v.boolean(),
  allowRegistration: v.boolean(),
  providerIds: v.nullable(v.array(organizationLoginPolicyProviderIdSchema)),
})

export type OrganizationLoginPolicy = v.InferOutput<typeof organizationLoginPolicySchema>
