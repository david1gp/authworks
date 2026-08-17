import * as v from "valibot"
import { projectApplicationTypeSchema } from "../domain/projectApplicationTypeSchema.js"

export const projectApplicationCreateRequestSchema = v.strictObject({
  applicationType: projectApplicationTypeSchema,
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
})

export type ProjectApplicationCreateRequest = v.InferOutput<typeof projectApplicationCreateRequestSchema>
