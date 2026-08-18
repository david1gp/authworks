import * as v from "valibot"
import { projectApplicationTypeSchema } from "../public/projectApplicationTypeSchema.js"

export const projectApplicationCreatedEventPayloadSchema = v.strictObject({
  applicationType: projectApplicationTypeSchema,
  applicationId: v.string(),
  name: v.string(),
  projectId: v.string(),
})

export type ProjectApplicationCreatedEventPayload = v.InferOutput<typeof projectApplicationCreatedEventPayloadSchema>
