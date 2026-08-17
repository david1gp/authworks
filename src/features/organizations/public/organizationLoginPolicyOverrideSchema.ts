import * as v from "valibot"

const organizationLoginPolicyProviderIdSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(128))

export const organizationLoginPolicyOverrideSchema = v.strictObject({
  allowDomainDiscovery: v.optional(v.nullable(v.boolean())),
  allowEmailOtp: v.optional(v.nullable(v.boolean())),
  allowExternalIdentity: v.optional(v.nullable(v.boolean())),
  allowPassword: v.optional(v.nullable(v.boolean())),
  allowPasswordRecovery: v.optional(v.nullable(v.boolean())),
  allowPasskey: v.optional(v.nullable(v.boolean())),
  allowRegistration: v.optional(v.nullable(v.boolean())),
  providerIds: v.optional(v.nullable(v.array(organizationLoginPolicyProviderIdSchema))),
})

export type OrganizationLoginPolicyOverride = v.InferOutput<typeof organizationLoginPolicyOverrideSchema>
