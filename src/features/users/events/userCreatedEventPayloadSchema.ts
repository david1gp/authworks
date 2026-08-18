import * as v from "valibot"
import { userStateSchema } from "../public/userStateSchema.js"

export const userCreatedEventPayloadSchema = v.strictObject({
  emailVerified: v.boolean(),
  state: userStateSchema,
})

export type UserCreatedEventPayload = v.InferOutput<typeof userCreatedEventPayloadSchema>
