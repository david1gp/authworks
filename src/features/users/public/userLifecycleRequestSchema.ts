import * as v from "valibot"
import { userStateSchema } from "../domain/userStateSchema.js"

export const userLifecycleRequestSchema = v.strictObject({ state: userStateSchema })

export type UserLifecycleRequest = v.InferOutput<typeof userLifecycleRequestSchema>
