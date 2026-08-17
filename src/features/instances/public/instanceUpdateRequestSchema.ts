import * as v from "valibot"
import { instanceStatusSchema } from "../domain/instanceStatusSchema.js"

export const instanceUpdateRequestSchema = v.strictObject({
  domain: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(253))),
  domains: v.optional(v.pipe(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(253))), v.maxLength(31))),
  name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
  status: v.optional(instanceStatusSchema),
})

export type InstanceUpdateRequest = v.InferOutput<typeof instanceUpdateRequestSchema>
