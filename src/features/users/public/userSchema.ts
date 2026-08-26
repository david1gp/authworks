import * as v from "valibot"
import { realmResourceIdSchema } from "../../realms/public/index.js"
import { userPhoneNumberSchema } from "./userPhoneNumberSchema.js"
import { userProfileSchema } from "./userProfileSchema.js"
import { userRegistrationVerificationMethodSchema } from "./userRegistrationVerificationMethodSchema.js"
import { userResourceIdSchema } from "./userResourceIdSchema.js"
import { userStateSchema } from "./userStateSchema.js"
import { userVerificationStateSchema } from "./userVerificationStateSchema.js"

export const userSchema = v.strictObject({
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  deletedAt: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  email: v.pipe(v.string(), v.minLength(3), v.maxLength(320)),
  emailVerified: v.boolean(),
  emailVerifiedAt: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  id: userResourceIdSchema,
  phoneNumber: v.optional(userPhoneNumberSchema),
  phoneNumberVerifiedAt: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  realmId: realmResourceIdSchema,
  profile: userProfileSchema,
  registrationVerifiedAt: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  registrationVerificationMethod: v.optional(userRegistrationVerificationMethodSchema),
  state: userStateSchema,
  updatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  userName: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  verificationState: userVerificationStateSchema,
})

export type User = v.InferOutput<typeof userSchema>
