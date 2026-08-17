import * as v from "valibot"

export const instanceCreatedEventPayloadSchema = v.strictObject({
  domain: v.string(),
  name: v.string(),
})

export type InstanceCreatedEventPayload = v.InferOutput<typeof instanceCreatedEventPayloadSchema>
