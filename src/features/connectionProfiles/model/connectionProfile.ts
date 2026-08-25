import * as v from "valibot"

export const connectionProfileSchema = v.strictObject({
  organizationId: v.optional(v.pipe(v.string(), v.minLength(1))),
  realmId: v.optional(v.pipe(v.string(), v.minLength(1))),
  server: v.optional(v.pipe(v.string(), v.minLength(1))),
  token: v.optional(v.pipe(v.string(), v.minLength(1))),
})

export type ConnectionProfile = v.InferOutput<typeof connectionProfileSchema>
