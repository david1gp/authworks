import * as v from "valibot"
import { userPhoneNumberSchema } from "./userPhoneNumberSchema.js"

export const userPhoneNumberSaveRequestSchema = v.strictObject({
  phoneNumber: userPhoneNumberSchema,
})

export type UserPhoneNumberSaveRequest = v.InferOutput<typeof userPhoneNumberSaveRequestSchema>
