import * as v from "valibot"
import { listQuerySchema } from "../../../platform/http/listQuerySchema.js"

export const organizationMetadataListQuerySchema = v.strictObject({
  ...listQuerySchema.entries,
  keyPrefix: v.optional(v.pipe(v.string(), v.maxLength(128))),
})

export type OrganizationMetadataListQuery = v.InferOutput<typeof organizationMetadataListQuerySchema>
