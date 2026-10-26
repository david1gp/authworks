import * as v from "valibot"

export const oidcRefreshTokenAbsoluteLifetimeSecondsSchema = v.nullable(
  v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(31536000)),
)

export type OidcRefreshTokenAbsoluteLifetimeSeconds = v.InferOutput<
  typeof oidcRefreshTokenAbsoluteLifetimeSecondsSchema
>
