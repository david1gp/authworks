import * as v from "valibot"
import { oidcResourceIdSchema } from "../domain/oidcResourceIdSchema.js"

export const oidcPublicJwkSchema = v.strictObject({
  alg: v.literal("RS256"),
  e: v.pipe(v.string(), v.minLength(1)),
  kid: oidcResourceIdSchema,
  kty: v.literal("RSA"),
  n: v.pipe(v.string(), v.minLength(1)),
  use: v.literal("sig"),
})

export type OidcPublicJwk = v.InferOutput<typeof oidcPublicJwkSchema>
