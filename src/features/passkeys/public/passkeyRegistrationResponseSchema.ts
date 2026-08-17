import * as v from "valibot"

const passkeyBase64UrlSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(8192), v.regex(/^[A-Za-z0-9_-]+$/))

export const passkeyRegistrationResponseSchema = v.strictObject({
  authenticatorAttachment: v.optional(v.picklist(["cross-platform", "platform"])),
  clientExtensionResults: v.record(v.string(), v.unknown()),
  id: v.pipe(v.string(), v.minLength(1), v.maxLength(500), v.regex(/^[A-Za-z0-9_-]+$/)),
  rawId: v.pipe(v.string(), v.minLength(1), v.maxLength(500), v.regex(/^[A-Za-z0-9_-]+$/)),
  response: v.strictObject({
    attestationObject: passkeyBase64UrlSchema,
    authenticatorData: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(4096), v.regex(/^[A-Za-z0-9_-]+$/))),
    clientDataJSON: v.pipe(v.string(), v.minLength(1), v.maxLength(8192), v.regex(/^[A-Za-z0-9_-]+$/)),
    publicKey: v.optional(passkeyBase64UrlSchema),
    publicKeyAlgorithm: v.optional(v.number()),
    transports: v.optional(v.array(v.picklist(["ble", "cable", "hybrid", "internal", "nfc", "smart-card", "usb"]))),
  }),
  type: v.literal("public-key"),
})

export type PasskeyRegistrationResponse = v.InferOutput<typeof passkeyRegistrationResponseSchema>
