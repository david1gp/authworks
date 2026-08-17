import * as v from "valibot"
import { projectApplicationStatusSchema } from "../domain/projectApplicationStatusSchema.js"

export const projectApplicationStatusChangedEventPayloadSchema = v.strictObject({
  applicationId: v.string(),
  status: projectApplicationStatusSchema,
})

export type ProjectApplicationStatusChangedEventPayload = v.InferOutput<
  typeof projectApplicationStatusChangedEventPayloadSchema
>
