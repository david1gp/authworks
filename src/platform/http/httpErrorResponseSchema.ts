import * as v from "valibot"

export const httpErrorResponseSchema = v.object({
  error: v.object({
    code: v.pipe(v.string(), v.regex(/^[a-z][a-z0-9_]{0,63}$/)),
    message: v.pipe(v.string(), v.maxLength(1000)),
  }),
})

export type HttpErrorResponse = v.InferOutput<typeof httpErrorResponseSchema>
