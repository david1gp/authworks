import * as v from "valibot"
import { organizationMetadataKeySchema } from "./organizationMetadataKeySchema.js"
import { organizationMetadataValueSchema } from "./organizationMetadataValueSchema.js"

export const organizationMetadataSchema = v.strictObject({
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  key: organizationMetadataKeySchema,
  organizationId: v.pipe(v.string(), v.minLength(1)),
  updatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  value: organizationMetadataValueSchema,
  version: v.pipe(v.number(), v.integer(), v.minValue(1)),
})

export type OrganizationMetadata = v.InferOutput<typeof organizationMetadataSchema>
