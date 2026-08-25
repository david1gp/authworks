import * as v from "valibot"
import { oidcSigningKeySchema } from "./oidcSigningKeySchema.js"

export const oidcSigningKeyEnsureResponseSchema = v.strictObject({
  action: v.picklist(["created", "reused"]),
  signingKey: oidcSigningKeySchema,
})

export type OidcSigningKeyEnsureResponse = v.InferOutput<typeof oidcSigningKeyEnsureResponseSchema>
