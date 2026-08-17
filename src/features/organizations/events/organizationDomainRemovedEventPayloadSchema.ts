import * as v from "valibot"

export const organizationDomainRemovedEventPayloadSchema = v.strictObject({
  domain: v.pipe(v.string(), v.minLength(1), v.maxLength(253)),
})

export type OrganizationDomainRemovedEventPayload = v.InferOutput<typeof organizationDomainRemovedEventPayloadSchema>
