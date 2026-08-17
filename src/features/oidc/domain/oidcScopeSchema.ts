import * as v from "valibot"

export const oidcScopeSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(100), v.regex(/^[A-Za-z0-9:._-]+$/))

export type OidcScope = v.InferOutput<typeof oidcScopeSchema>
