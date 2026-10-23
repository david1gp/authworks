import * as v from "valibot"

export const projectDetailTabSchema = v.picklist(["overview", "roles", "applications", "access"])

export type ProjectDetailTab = v.InferOutput<typeof projectDetailTabSchema>
