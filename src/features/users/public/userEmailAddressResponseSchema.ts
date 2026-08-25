import * as v from "valibot"
import { userEmailAddressSchema } from "./userEmailAddressSchema.js"

export const userEmailAddressResponseSchema = v.strictObject({ email: userEmailAddressSchema })

export type UserEmailAddressResponse = v.InferOutput<typeof userEmailAddressResponseSchema>
