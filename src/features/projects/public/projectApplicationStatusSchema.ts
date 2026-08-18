import * as v from "valibot"

export const projectApplicationStatusSchema = v.picklist(["active", "inactive", "removed"])

export type ProjectApplicationStatus = v.InferOutput<typeof projectApplicationStatusSchema>
