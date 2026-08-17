import * as v from "valibot"
import { instanceStatusSchema } from "../domain/instanceStatusSchema.js"

export const instanceUpdatedEventPayloadSchema = v.strictObject({
  domain: v.string(),
  name: v.string(),
  status: instanceStatusSchema,
})

export type InstanceUpdatedEventPayload = v.InferOutput<typeof instanceUpdatedEventPayloadSchema>
