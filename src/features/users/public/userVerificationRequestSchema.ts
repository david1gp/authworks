import * as v from "valibot"
import { userVerificationStateSchema } from "./userVerificationStateSchema.js"

export const userVerificationRequestSchema = v.strictObject({ state: userVerificationStateSchema })

export type UserVerificationRequest = v.InferOutput<typeof userVerificationRequestSchema>
