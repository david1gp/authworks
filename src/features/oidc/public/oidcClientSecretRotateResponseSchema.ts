import * as v from "valibot"
import { oidcClientSchema } from "./oidcClientSchema.js"

export const oidcClientSecretRotateResponseSchema = v.strictObject({
  client: oidcClientSchema,
  clientSecret: v.pipe(v.string(), v.minLength(43)),
})

export type OidcClientSecretRotateResponse = v.InferOutput<typeof oidcClientSecretRotateResponseSchema>
