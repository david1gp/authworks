import * as v from "valibot"

const passkeyBase64UrlSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(8192), v.regex(/^[A-Za-z0-9_-]+$/))

export const passkeyAuthenticationResponseSchema = v.strictObject({
  authenticatorAttachment: v.optional(v.picklist(["cross-platform", "platform"])),
  clientExtensionResults: v.record(v.string(), v.unknown()),
  id: v.pipe(v.string(), v.minLength(1), v.maxLength(500), v.regex(/^[A-Za-z0-9_-]+$/)),
  rawId: v.pipe(v.string(), v.minLength(1), v.maxLength(500), v.regex(/^[A-Za-z0-9_-]+$/)),
  response: v.strictObject({
    authenticatorData: v.pipe(v.string(), v.minLength(1), v.maxLength(4096), v.regex(/^[A-Za-z0-9_-]+$/)),
    clientDataJSON: v.pipe(v.string(), v.minLength(1), v.maxLength(8192), v.regex(/^[A-Za-z0-9_-]+$/)),
    signature: v.pipe(v.string(), v.minLength(1), v.maxLength(4096), v.regex(/^[A-Za-z0-9_-]+$/)),
    userHandle: v.optional(v.pipe(v.string(), v.maxLength(500), v.regex(/^[A-Za-z0-9_-]*$/))),
  }),
  type: v.literal("public-key"),
})

export type PasskeyAuthenticationResponse = v.InferOutput<typeof passkeyAuthenticationResponseSchema>
