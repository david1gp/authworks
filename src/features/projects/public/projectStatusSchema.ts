import * as v from "valibot"

export const projectStatusSchema = v.picklist(["active", "inactive", "removed"])

export type ProjectStatus = v.InferOutput<typeof projectStatusSchema>
