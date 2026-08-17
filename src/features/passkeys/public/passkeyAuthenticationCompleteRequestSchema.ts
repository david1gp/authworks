import * as v from "valibot"
import { passkeyAuthenticationResponseSchema } from "./passkeyAuthenticationResponseSchema.js"

export const passkeyAuthenticationCompleteRequestSchema = v.strictObject({
  response: passkeyAuthenticationResponseSchema,
  token: v.pipe(v.string(), v.minLength(43), v.maxLength(256)),
})

export type PasskeyAuthenticationCompleteRequest = v.InferOutput<typeof passkeyAuthenticationCompleteRequestSchema>
