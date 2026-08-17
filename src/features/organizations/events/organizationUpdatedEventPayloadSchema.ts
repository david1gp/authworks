import * as v from "valibot"

export const organizationUpdatedEventPayloadSchema = v.strictObject({ name: v.string() })

export type OrganizationUpdatedEventPayload = v.InferOutput<typeof organizationUpdatedEventPayloadSchema>
