import * as v from "valibot"
import { projectSchema } from "./projectSchema.js"

/** List item for the project directory, including admin list counts when the caller counts them. */
export const projectListItemSchema = v.strictObject({
  ...projectSchema.entries,
  applicationCount: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  roleCount: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
})

export type ProjectListItem = v.InferOutput<typeof projectListItemSchema>
