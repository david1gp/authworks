import * as v from "valibot"

export const resultErrorCodeSchema = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$/))

export type ResultErrorCode = v.InferOutput<typeof resultErrorCodeSchema>
