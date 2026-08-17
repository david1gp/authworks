import * as v from "valibot"
import { organizationBrandingSchema } from "./organizationBrandingSchema.js"
import { organizationLoginPolicySchema } from "./organizationLoginPolicySchema.js"
import { organizationResourceIdSchema } from "./organizationResourceIdSchema.js"
import { externalIdentityProviderTypeSchema } from "../../externalIdentities/public/externalIdentityProviderTypeSchema.js"

const organizationDiscoveryOrganizationSchema = v.strictObject({
  id: organizationResourceIdSchema,
  instanceId: organizationResourceIdSchema,
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
})

const organizationDiscoveryProviderSchema = v.strictObject({
  displayName: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  id: organizationResourceIdSchema,
  type: externalIdentityProviderTypeSchema,
})

export const organizationDiscoveryResponseSchema = v.union([
  v.strictObject({ found: v.literal(false) }),
  v.strictObject({
    branding: organizationBrandingSchema,
    domain: v.pipe(v.string(), v.minLength(1), v.maxLength(253)),
    found: v.literal(true),
    organization: organizationDiscoveryOrganizationSchema,
    policy: organizationLoginPolicySchema,
    providers: v.array(organizationDiscoveryProviderSchema),
  }),
])

export type OrganizationDiscoveryResponse = v.InferOutput<typeof organizationDiscoveryResponseSchema>
