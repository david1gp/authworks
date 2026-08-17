import * as v from "valibot"

export const organizationCreatedEventPayloadSchema = v.strictObject({ name: v.string() })

export type OrganizationCreatedEventPayload = v.InferOutput<typeof organizationCreatedEventPayloadSchema>
