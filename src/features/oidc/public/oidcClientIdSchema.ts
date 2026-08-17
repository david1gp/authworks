import * as v from "valibot"

export const oidcClientIdSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(128))

export type OidcClientId = v.InferOutput<typeof oidcClientIdSchema>
