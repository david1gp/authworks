import * as v from "valibot"

export const sessionRevocationResponseSchema = v.strictObject({ revoked: v.boolean() })

export type SessionRevocationResponse = v.InferOutput<typeof sessionRevocationResponseSchema>
