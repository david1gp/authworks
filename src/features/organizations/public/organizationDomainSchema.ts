import * as v from "valibot"
import { organizationResourceIdSchema } from "./organizationResourceIdSchema.js"

export const organizationDomainSchema = v.strictObject({
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  domain: v.pipe(v.string(), v.minLength(1), v.maxLength(253)),
  instanceId: organizationResourceIdSchema,
  isPrimary: v.boolean(),
  organizationId: organizationResourceIdSchema,
  updatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  verification: v.optional(
    v.strictObject({
      recordName: v.pipe(v.string(), v.minLength(1), v.maxLength(320)),
      recordType: v.literal("TXT"),
      recordValue: v.pipe(v.string(), v.minLength(16), v.maxLength(512)),
    }),
  ),
  verified: v.boolean(),
  version: v.pipe(v.number(), v.integer(), v.minValue(1)),
})

export type OrganizationDomain = v.InferOutput<typeof organizationDomainSchema>
