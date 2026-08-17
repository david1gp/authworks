import * as v from "valibot"
import { organizationBrandingSchema } from "./organizationBrandingSchema.js"
import { organizationResourceIdSchema } from "./organizationResourceIdSchema.js"

export const organizationBrandingResponseSchema = v.strictObject({
  branding: organizationBrandingSchema,
  organizationId: organizationResourceIdSchema,
  updatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  version: v.pipe(v.number(), v.integer(), v.minValue(1)),
})

export type OrganizationBrandingResponse = v.InferOutput<typeof organizationBrandingResponseSchema>
