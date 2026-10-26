import * as v from "valibot"
import { organizationMetadataSchema } from "./organizationMetadataSchema.js"

export const organizationMetadataResponseSchema = v.strictObject({
  metadata: organizationMetadataSchema,
})

export type OrganizationMetadataResponse = v.InferOutput<typeof organizationMetadataResponseSchema>
