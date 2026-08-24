import * as v from "valibot"
import { resultErrorCodeSchema } from "../errors/resultErrorCodeSchema.js"

export const httpErrorCodeSchema = v.union([resultErrorCodeSchema, v.literal("rate_limited")])

export type HttpErrorCode = v.InferOutput<typeof httpErrorCodeSchema>
