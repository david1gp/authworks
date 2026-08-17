import * as v from "valibot"

export const organizationSwitchedEventPayloadSchema = v.strictObject({ organizationId: v.string() })

export type OrganizationSwitchedEventPayload = v.InferOutput<typeof organizationSwitchedEventPayloadSchema>
