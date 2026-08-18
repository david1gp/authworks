import * as v from "valibot"
import { userStateSchema } from "../domain/userStateSchema.js"
import { userVerificationStateSchema } from "../domain/userVerificationStateSchema.js"
import { userProfileSchema } from "./userProfileSchema.js"
import { userResourceIdSchema } from "./userResourceIdSchema.js"

export const userSchema = v.strictObject({
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  deletedAt: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  email: v.pipe(v.string(), v.minLength(3), v.maxLength(320)),
  emailVerified: v.boolean(),
  emailVerifiedAt: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  id: userResourceIdSchema,
  realmId: userResourceIdSchema,
  profile: userProfileSchema,
  state: userStateSchema,
  updatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  userName: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  verificationState: userVerificationStateSchema,
})

export type User = v.InferOutput<typeof userSchema>
