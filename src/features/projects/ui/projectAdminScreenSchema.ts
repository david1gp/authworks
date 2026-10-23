import * as v from "valibot"

export const projectAdminScreenSchema = v.picklist(["projects", "project-detail"])

export type ProjectAdminScreen = v.InferOutput<typeof projectAdminScreenSchema>
