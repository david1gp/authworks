import * as v from "valibot"
import { organizationStatusSchema } from "../domain/organizationStatusSchema.js"

export const organizationStatusChangedEventPayloadSchema = v.strictObject({ status: organizationStatusSchema })

export type OrganizationStatusChangedEventPayload = v.InferOutput<typeof organizationStatusChangedEventPayloadSchema>
