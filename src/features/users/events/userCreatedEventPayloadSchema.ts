import * as v from "valibot"
import { userStateSchema } from "../domain/userStateSchema.js"

export const userCreatedEventPayloadSchema = v.strictObject({
  emailVerified: v.boolean(),
  state: userStateSchema,
})

export type UserCreatedEventPayload = v.InferOutput<typeof userCreatedEventPayloadSchema>
