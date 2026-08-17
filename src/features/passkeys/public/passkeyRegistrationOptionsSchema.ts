import * as v from "valibot"

const passkeyBase64UrlSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(8192), v.regex(/^[A-Za-z0-9_-]+$/))

export const passkeyRegistrationOptionsSchema = v.looseObject({
  attestation: v.literal("none"),
  authenticatorSelection: v.optional(
    v.looseObject({
      residentKey: v.optional(v.picklist(["discouraged", "preferred", "required"])),
      requireResidentKey: v.optional(v.boolean()),
      userVerification: v.picklist(["required", "preferred", "discouraged"]),
    }),
  ),
  challenge: passkeyBase64UrlSchema,
  excludeCredentials: v.optional(
    v.array(
      v.looseObject({
        id: passkeyBase64UrlSchema,
        transports: v.optional(v.array(v.picklist(["ble", "cable", "hybrid", "internal", "nfc", "smart-card", "usb"]))),
        type: v.literal("public-key"),
      }),
    ),
  ),
  pubKeyCredParams: v.array(v.looseObject({ alg: v.number(), type: v.literal("public-key") })),
  rp: v.looseObject({
    id: v.pipe(v.string(), v.minLength(1), v.maxLength(253)),
    name: v.pipe(v.string(), v.minLength(1)),
  }),
  timeout: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(120_000))),
  user: v.looseObject({
    displayName: v.pipe(v.string(), v.maxLength(128)),
    id: passkeyBase64UrlSchema,
    name: v.pipe(v.string(), v.minLength(1), v.maxLength(320)),
  }),
})

export type PasskeyRegistrationOptions = v.InferOutput<typeof passkeyRegistrationOptionsSchema>
