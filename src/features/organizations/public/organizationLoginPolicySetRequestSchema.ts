import {
  organizationLoginPolicyOverrideSchema,
  type OrganizationLoginPolicyOverride,
} from "./organizationLoginPolicyOverrideSchema.js"

export const organizationLoginPolicySetRequestSchema = organizationLoginPolicyOverrideSchema

export type OrganizationLoginPolicySetRequest = OrganizationLoginPolicyOverride
