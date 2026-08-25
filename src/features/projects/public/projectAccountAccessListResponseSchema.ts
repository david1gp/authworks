import * as v from "valibot"
import { projectAccountAccessSchema } from "./projectAccountAccessSchema.js"

export const projectAccountAccessListResponseSchema = v.strictObject({
  items: v.array(projectAccountAccessSchema),
})

export type ProjectAccountAccessListResponse = v.InferOutput<typeof projectAccountAccessListResponseSchema>
