import * as v from "valibot"
import { userMetadataKeySchema } from "./userMetadataKeySchema.js"
import { userMetadataValueSchema } from "./userMetadataValueSchema.js"

export const userMetadataSchema = v.strictObject({
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  key: userMetadataKeySchema,
  updatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  userId: v.pipe(v.string(), v.minLength(1)),
  value: userMetadataValueSchema,
  version: v.pipe(v.number(), v.integer(), v.minValue(1)),
})

export type UserMetadata = v.InferOutput<typeof userMetadataSchema>
