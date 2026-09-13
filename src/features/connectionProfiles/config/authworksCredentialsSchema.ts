import * as v from "valibot"
import { authworksTestUserSchema } from "./authworksTestUserSchema.js"

export const authworksCredentialsSchema = v.strictObject({
  testUsers: v.optional(v.record(v.string(), authworksTestUserSchema)),
  token: v.optional(v.pipe(v.string(), v.minLength(1))),
})

export type AuthworksCredentials = v.InferOutput<typeof authworksCredentialsSchema>
