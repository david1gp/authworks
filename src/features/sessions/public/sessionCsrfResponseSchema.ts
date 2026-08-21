import * as v from "valibot"

export const sessionCsrfResponseSchema = v.strictObject({
  csrfToken: v.pipe(v.string(), v.minLength(1)),
})

export type SessionCsrfResponse = v.InferOutput<typeof sessionCsrfResponseSchema>
