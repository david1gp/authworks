import * as v from "valibot"
import { oidcClientSchema } from "./oidcClientSchema.js"

export const oidcClientCreateResponseSchema = v.strictObject({
  client: oidcClientSchema,
  clientSecret: v.optional(v.pipe(v.string(), v.minLength(43))),
})

export type OidcClientCreateResponse = v.InferOutput<typeof oidcClientCreateResponseSchema>
