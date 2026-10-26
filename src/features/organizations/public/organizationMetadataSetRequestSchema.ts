import * as v from "valibot"
import { organizationMetadataValueSchema } from "./organizationMetadataValueSchema.js"

export const organizationMetadataSetRequestSchema = v.strictObject({
  value: organizationMetadataValueSchema,
})

export type OrganizationMetadataSetRequest = v.InferOutput<typeof organizationMetadataSetRequestSchema>
