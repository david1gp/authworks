import {
  type OrganizationLoginPolicyOverride,
  organizationLoginPolicyOverrideSchema,
} from "./organizationLoginPolicyOverrideSchema.js"

export const organizationLoginPolicySetRequestSchema = organizationLoginPolicyOverrideSchema

export type OrganizationLoginPolicySetRequest = OrganizationLoginPolicyOverride
