import * as v from "valibot"

export const organizationBrandingChangedEventPayloadSchema = v.strictObject({
  organizationId: v.string(),
  version: v.pipe(v.number(), v.integer(), v.minValue(1)),
})

export type OrganizationBrandingChangedEventPayload = v.InferOutput<
  typeof organizationBrandingChangedEventPayloadSchema
>
