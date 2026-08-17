import * as v from "valibot"

export const sessionRevokeAllRequestSchema = v.strictObject({ keepCurrent: v.optional(v.boolean()) })

export type SessionRevokeAllRequest = v.InferOutput<typeof sessionRevokeAllRequestSchema>
