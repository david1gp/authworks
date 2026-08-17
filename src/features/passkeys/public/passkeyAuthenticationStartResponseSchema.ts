import * as v from "valibot"
import { passkeyAuthenticationOptionsSchema } from "./passkeyAuthenticationOptionsSchema.js"

export const passkeyAuthenticationStartResponseSchema = v.strictObject({
  options: passkeyAuthenticationOptionsSchema,
  token: v.pipe(v.string(), v.minLength(43), v.maxLength(256)),
})

export type PasskeyAuthenticationStartResponse = v.InferOutput<typeof passkeyAuthenticationStartResponseSchema>
