import * as v from "valibot"

export const oidcRefreshTokenIdleLifetimeSecondsSchema = v.nullable(
  v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(31536000)),
)

export type OidcRefreshTokenIdleLifetimeSeconds = v.InferOutput<typeof oidcRefreshTokenIdleLifetimeSecondsSchema>
