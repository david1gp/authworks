import * as v from "valibot"
import { passkeyRegistrationResponseSchema } from "./passkeyRegistrationResponseSchema.js"

export const passkeyRegistrationCompleteRequestSchema = v.strictObject({
  response: passkeyRegistrationResponseSchema,
  token: v.pipe(v.string(), v.minLength(43), v.maxLength(256)),
})

export type PasskeyRegistrationCompleteRequest = v.InferOutput<typeof passkeyRegistrationCompleteRequestSchema>
