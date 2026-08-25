import * as v from "valibot"
import { realmResourceIdSchema } from "../../realms/public/realmResourceIdSchema.js"
import { organizationLoginPolicyOverrideSchema } from "./organizationLoginPolicyOverrideSchema.js"
import { organizationLoginPolicySchema } from "./organizationLoginPolicySchema.js"
import { organizationResourceIdSchema } from "./organizationResourceIdSchema.js"

export const organizationLoginPolicyResponseSchema = v.strictObject({
  realmId: realmResourceIdSchema,
  organizationId: v.nullable(organizationResourceIdSchema),
  overrides: organizationLoginPolicyOverrideSchema,
  policy: organizationLoginPolicySchema,
})

export type OrganizationLoginPolicyResponse = v.InferOutput<typeof organizationLoginPolicyResponseSchema>
