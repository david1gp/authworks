import * as v from "valibot"

export const instanceCreateRequestSchema = v.strictObject({
  domain: v.pipe(v.string(), v.minLength(1), v.maxLength(253)),
  domains: v.optional(v.pipe(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(253))), v.maxLength(31))),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
})

export type InstanceCreateRequest = v.InferOutput<typeof instanceCreateRequestSchema>
