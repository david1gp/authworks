import * as v from "valibot"

export const oidcAccessTokenLifetimeSecondsSchema = v.nullable(
  v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(86400)),
)

export type OidcAccessTokenLifetimeSeconds = v.InferOutput<typeof oidcAccessTokenLifetimeSecondsSchema>
