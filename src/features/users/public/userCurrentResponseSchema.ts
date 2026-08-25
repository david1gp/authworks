import * as v from "valibot"
import { userCapabilitiesSchema } from "./userCapabilitiesSchema.js"
import { userSchema } from "./userSchema.js"

export const userCurrentResponseSchema = v.strictObject({ capabilities: userCapabilitiesSchema, user: userSchema })

export type UserCurrentResponse = v.InferOutput<typeof userCurrentResponseSchema>
