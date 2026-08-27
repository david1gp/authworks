import * as v from "valibot"

const authworksOrganizationMembershipResourceIdSchema = v.pipe(
  v.string(),
  v.regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
)
const zitadelMembershipResourceIdSchema = v.pipe(v.string(), v.regex(/^[1-9][0-9]{0,19}$/))
const legacyMembershipResourceIdSchema = v.pipe(v.string(), v.regex(/^membership-[1-9][0-9]{0,19}$/))
const zitadelMembershipFallbackResourceIdSchema = v.pipe(
  v.string(),
  v.regex(/^zitadel-membership-[1-9][0-9]{0,19}-[1-9][0-9]{0,19}$/),
)

export const organizationMembershipResourceIdSchema = v.union([
  authworksOrganizationMembershipResourceIdSchema,
  zitadelMembershipResourceIdSchema,
  legacyMembershipResourceIdSchema,
  zitadelMembershipFallbackResourceIdSchema,
])

export type OrganizationMembershipResourceId = v.InferOutput<typeof organizationMembershipResourceIdSchema>
