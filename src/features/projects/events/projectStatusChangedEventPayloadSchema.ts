import * as v from "valibot"
import { projectStatusSchema } from "../domain/projectStatusSchema.js"

export const projectStatusChangedEventPayloadSchema = v.strictObject({ status: projectStatusSchema })

export type ProjectStatusChangedEventPayload = v.InferOutput<typeof projectStatusChangedEventPayloadSchema>
