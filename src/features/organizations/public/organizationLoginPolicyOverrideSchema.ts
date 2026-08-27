import * as v from "valibot"
import { organizationLoginPolicyAssuranceSchema } from "./organizationLoginPolicyAssuranceSchema.js"
import { organizationLoginPolicyFactorListSchema } from "./organizationLoginPolicyFactorListSchema.js"

const organizationLoginPolicyProviderIdSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(128))
const organizationLoginPolicySessionLifetimeSecondsSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(1),
  v.maxValue(365 * 24 * 60 * 60),
)

export const organizationLoginPolicyOverrideSchema = v.strictObject({
  allowDomainDiscovery: v.optional(v.nullable(v.boolean())),
  allowEmailOtp: v.optional(v.nullable(v.boolean())),
  allowWhatsappOtp: v.optional(v.nullable(v.boolean())),
  allowExternalIdentity: v.optional(v.nullable(v.boolean())),
  allowExternalIdentityAutoLinking: v.optional(v.nullable(v.boolean())),
  allowPassword: v.optional(v.nullable(v.boolean())),
  allowPasswordRecovery: v.optional(v.nullable(v.boolean())),
  allowPasskey: v.optional(v.nullable(v.boolean())),
  allowRegistration: v.optional(v.nullable(v.boolean())),
  providerIds: v.optional(v.nullable(v.array(organizationLoginPolicyProviderIdSchema))),
  sessionLifetimeSeconds: v.optional(v.nullable(organizationLoginPolicySessionLifetimeSecondsSchema)),
  requiredMfa: v.optional(v.nullable(v.boolean())),
  allowedFactors: v.optional(v.nullable(organizationLoginPolicyFactorListSchema)),
  preferredFactorOrder: v.optional(v.nullable(organizationLoginPolicyFactorListSchema)),
  minimumStepUpAssurance: v.optional(v.nullable(organizationLoginPolicyAssuranceSchema)),
})

export type OrganizationLoginPolicyOverride = v.InferOutput<typeof organizationLoginPolicyOverrideSchema>
