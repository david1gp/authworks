import * as v from "valibot"

export const projectGrantStatusSchema = v.picklist(["active", "inactive", "removed"])

export type ProjectGrantStatus = v.InferOutput<typeof projectGrantStatusSchema>
