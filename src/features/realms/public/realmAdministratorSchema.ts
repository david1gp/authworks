import * as v from "valibot"

export const realmAdministratorSchema = v.strictObject({
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  createdBy: v.optional(v.pipe(v.string(), v.minLength(1))),
  realmId: v.pipe(v.string(), v.minLength(1)),
  user: v.strictObject({
    displayName: v.optional(v.pipe(v.string(), v.minLength(1))),
    email: v.pipe(v.string(), v.minLength(1)),
    userName: v.pipe(v.string(), v.minLength(1)),
  }),
  userId: v.pipe(v.string(), v.minLength(1)),
})

export type RealmAdministrator = v.InferOutput<typeof realmAdministratorSchema>
