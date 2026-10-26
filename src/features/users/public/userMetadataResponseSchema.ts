import * as v from "valibot"
import { userMetadataSchema } from "./userMetadataSchema.js"

export const userMetadataResponseSchema = v.strictObject({
  metadata: userMetadataSchema,
})

export type UserMetadataResponse = v.InferOutput<typeof userMetadataResponseSchema>
