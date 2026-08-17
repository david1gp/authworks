import * as v from "valibot"

export const externalIdentityEventPayloadSchema = v.strictObject({
  action: v.picklist([
    "account_created",
    "authentication_failed",
    "authentication_started",
    "authentication_succeeded",
    "linked",
    "provider_created",
    "provider_disabled",
    "provider_updated",
    "unlinked",
  ]),
  externalSubject: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(512))),
  identityId: v.optional(v.pipe(v.string(), v.minLength(1))),
  providerId: v.optional(v.pipe(v.string(), v.minLength(1))),
  providerType: v.optional(v.picklist(["google", "github", "microsoft"])),
  reason: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
  userId: v.optional(v.pipe(v.string(), v.minLength(1))),
})

export type ExternalIdentityEventPayload = v.InferOutput<typeof externalIdentityEventPayloadSchema>
