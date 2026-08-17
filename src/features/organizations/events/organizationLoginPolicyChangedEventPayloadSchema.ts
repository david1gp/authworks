import * as v from "valibot"
import { organizationLoginPolicySchema } from "../public/organizationLoginPolicySchema.js"

export const organizationLoginPolicyChangedEventPayloadSchema = v.strictObject({
  policy: organizationLoginPolicySchema,
})

export type OrganizationLoginPolicyChangedEventPayload = v.InferOutput<
  typeof organizationLoginPolicyChangedEventPayloadSchema
>
