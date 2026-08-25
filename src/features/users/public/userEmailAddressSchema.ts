import * as v from "valibot"
import { userEmailSchema } from "./userEmailSchema.js"

export const userEmailAddressSchema = v.strictObject({
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  email: userEmailSchema,
  id: v.pipe(v.string(), v.minLength(1)),
  isPrimary: v.boolean(),
  updatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  verified: v.boolean(),
  verifiedAt: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0))),
  version: v.pipe(v.number(), v.integer(), v.minValue(1)),
})

export type UserEmailAddress = v.InferOutput<typeof userEmailAddressSchema>
