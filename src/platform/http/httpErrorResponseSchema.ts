import * as v from "valibot"
import { resultErrorCodeSchema } from "../errors/resultErrorCodeSchema.js"

export const httpErrorResponseSchema = v.object({
  error: v.object({
    code: resultErrorCodeSchema,
    message: v.pipe(v.string(), v.maxLength(1000)),
    op: v.optional(v.string()),
    details: v.optional(v.record(v.string(), v.unknown())),
    status: v.optional(v.pipe(v.number(), v.integer())),
    requestId: v.optional(v.string()),
    retryable: v.optional(v.boolean()),
  }),
})

export type HttpErrorResponse = v.InferOutput<typeof httpErrorResponseSchema>
