import * as v from "valibot"

export const oidcOriginSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(2048))

export type OidcOrigin = v.InferOutput<typeof oidcOriginSchema>
