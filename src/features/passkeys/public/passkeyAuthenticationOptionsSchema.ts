import * as v from "valibot"

const passkeyBase64UrlSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(8192), v.regex(/^[A-Za-z0-9_-]+$/))

export const passkeyAuthenticationOptionsSchema = v.looseObject({
  allowCredentials: v.optional(
    v.array(
      v.looseObject({
        id: passkeyBase64UrlSchema,
        transports: v.optional(v.array(v.picklist(["ble", "cable", "hybrid", "internal", "nfc", "smart-card", "usb"]))),
        type: v.literal("public-key"),
      }),
    ),
  ),
  challenge: passkeyBase64UrlSchema,
  rpId: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(253))),
  timeout: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(120_000))),
  userVerification: v.picklist(["required", "preferred", "discouraged"]),
})

export type PasskeyAuthenticationOptions = v.InferOutput<typeof passkeyAuthenticationOptionsSchema>
