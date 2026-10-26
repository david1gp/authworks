import * as v from "valibot"

export const oidcIdTokenLifetimeSecondsSchema = v.nullable(
  v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(86400)),
)

export type OidcIdTokenLifetimeSeconds = v.InferOutput<typeof oidcIdTokenLifetimeSecondsSchema>
