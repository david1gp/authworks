import * as v from "valibot"

export const authworksTestUserSchema = v.strictObject({
  password: v.pipe(v.string(), v.minLength(1)),
  userId: v.pipe(v.string(), v.minLength(1)),
  username: v.pipe(v.string(), v.minLength(1)),
})

export type AuthworksTestUser = v.InferOutput<typeof authworksTestUserSchema>
