import * as v from "valibot"

export const organizationMetadataRemoveResponseSchema = v.strictObject({ removed: v.literal(true) })

export type OrganizationMetadataRemoveResponse = v.InferOutput<typeof organizationMetadataRemoveResponseSchema>
