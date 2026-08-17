import * as v from "valibot"

export const passkeyCredentialSchema = v.strictObject({
  aaguid: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
  backedUp: v.boolean(),
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  deviceType: v.picklist(["singleDevice", "multiDevice"]),
  id: v.pipe(v.string(), v.minLength(1)),
  lastUsedAt: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0))),
  revokedAt: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0))),
  transports: v.array(v.picklist(["ble", "cable", "hybrid", "internal", "nfc", "smart-card", "usb"])),
})

export type PasskeyCredential = v.InferOutput<typeof passkeyCredentialSchema>
