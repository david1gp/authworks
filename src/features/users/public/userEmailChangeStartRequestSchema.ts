import * as v from "valibot"
import { userEmailSchema } from "./userEmailSchema.js"

export const userEmailChangeStartRequestSchema = v.strictObject({ email: userEmailSchema })

export type UserEmailChangeStartRequest = v.InferOutput<typeof userEmailChangeStartRequestSchema>
