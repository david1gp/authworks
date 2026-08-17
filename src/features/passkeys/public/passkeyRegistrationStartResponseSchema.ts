import * as v from "valibot"
import { passkeyRegistrationOptionsSchema } from "./passkeyRegistrationOptionsSchema.js"

export const passkeyRegistrationStartResponseSchema = v.strictObject({
  options: passkeyRegistrationOptionsSchema,
  token: v.pipe(v.string(), v.minLength(43), v.maxLength(256)),
})

export type PasskeyRegistrationStartResponse = v.InferOutput<typeof passkeyRegistrationStartResponseSchema>
