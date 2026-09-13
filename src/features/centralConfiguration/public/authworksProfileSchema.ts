import * as v from "valibot"

export const authworksProfileSchema = v.strictObject({
  baseUrl: v.pipe(v.string(), v.minLength(1)),
  organizationId: v.pipe(v.string(), v.minLength(1)),
  realmId: v.optional(v.pipe(v.string(), v.minLength(1))),
})

export type AuthworksProfile = v.InferOutput<typeof authworksProfileSchema>
