import * as v from "valibot"
import { userMetadataValueSchema } from "./userMetadataValueSchema.js"

export const userMetadataSetRequestSchema = v.strictObject({
  value: userMetadataValueSchema,
})

export type UserMetadataSetRequest = v.InferOutput<typeof userMetadataSetRequestSchema>
