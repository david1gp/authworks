import * as v from "valibot"
import { userStateSchema } from "../domain/userStateSchema.js"

export const userStateChangedEventPayloadSchema = v.strictObject({
  from: userStateSchema,
  to: userStateSchema,
})

export type UserStateChangedEventPayload = v.InferOutput<typeof userStateChangedEventPayloadSchema>
