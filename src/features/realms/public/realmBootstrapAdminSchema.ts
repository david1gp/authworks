import * as v from "valibot"

export const realmBootstrapAdminSchema = v.strictObject({
  adminId: v.pipe(v.string(), v.regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)),
  secret: v.pipe(v.string(), v.minLength(32)),
})

export type RealmBootstrapAdmin = v.InferOutput<typeof realmBootstrapAdminSchema>
