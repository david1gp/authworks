import * as v from "valibot"

export const teamDeleteResponseSchema = v.strictObject({ deleted: v.literal(true) })

export type TeamDeleteResponse = v.InferOutput<typeof teamDeleteResponseSchema>
