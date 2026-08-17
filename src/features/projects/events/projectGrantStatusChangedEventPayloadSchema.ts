import * as v from "valibot"
import { projectGrantStatusSchema } from "../domain/projectGrantStatusSchema.js"

export const projectGrantStatusChangedEventPayloadSchema = v.strictObject({
  grantId: v.string(),
  status: projectGrantStatusSchema,
})

export type ProjectGrantStatusChangedEventPayload = v.InferOutput<typeof projectGrantStatusChangedEventPayloadSchema>
