import * as v from "valibot"

export const projectApplicationUpdateRequestSchema = v.strictObject({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
})

export type ProjectApplicationUpdateRequest = v.InferOutput<typeof projectApplicationUpdateRequestSchema>
