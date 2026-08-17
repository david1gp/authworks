import * as v from "valibot"

export const userDeletedEventPayloadSchema = v.strictObject({
  deletedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export type UserDeletedEventPayload = v.InferOutput<typeof userDeletedEventPayloadSchema>
