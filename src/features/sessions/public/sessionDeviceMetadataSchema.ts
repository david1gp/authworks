import * as v from "valibot"

export const sessionDeviceMetadataSchema = v.strictObject({
  description: v.optional(v.pipe(v.string(), v.maxLength(256))),
  fingerprint: v.optional(v.pipe(v.string(), v.maxLength(256))),
  ipAddress: v.optional(v.pipe(v.string(), v.maxLength(128))),
  userAgent: v.optional(v.pipe(v.string(), v.maxLength(512))),
})

export type SessionDeviceMetadata = v.InferOutput<typeof sessionDeviceMetadataSchema>
