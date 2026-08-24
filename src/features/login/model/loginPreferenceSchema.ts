import * as v from "valibot"

export const loginPreferenceSchema = v.strictObject({
  email: v.optional(v.pipe(v.string(), v.maxLength(254))),
  identifier: v.optional(v.pipe(v.string(), v.maxLength(254))),
  rememberIdentifier: v.boolean(),
  updatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  version: v.literal(1),
})

export type LoginPreference = v.InferOutput<typeof loginPreferenceSchema>
