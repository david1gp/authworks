import * as v from "valibot"
import { userEmailSchema } from "./userEmailSchema.js"

export const userEmailAddressAddStartRequestSchema = v.strictObject({ email: userEmailSchema })

export type UserEmailAddressAddStartRequest = v.InferOutput<typeof userEmailAddressAddStartRequestSchema>
