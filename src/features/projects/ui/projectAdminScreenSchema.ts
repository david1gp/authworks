import * as v from "valibot"

export const projectAdminScreenSchema = v.picklist([
  "projects",
  "project-detail",
  "applications",
  "roles-grants",
  "effective-access",
])

export type ProjectAdminScreen = v.InferOutput<typeof projectAdminScreenSchema>
