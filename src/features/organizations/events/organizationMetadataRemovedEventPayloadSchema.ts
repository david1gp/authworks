import * as v from "valibot"

// Deviation from Zitadel: Zitadel metadata events carry values. Ours carry the
// key only so stored values never leak into the append-only event log.
export const organizationMetadataRemovedEventPayloadSchema = v.strictObject({
  key: v.string(),
  organizationId: v.string(),
})

export type OrganizationMetadataRemovedEventPayload = v.InferOutput<
  typeof organizationMetadataRemovedEventPayloadSchema
>
