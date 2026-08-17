import * as v from "valibot"
import { projectRoleSchema } from "./projectRoleSchema.js"

export const projectRoleListResponseSchema = v.strictObject({ roles: v.array(projectRoleSchema) })

export type ProjectRoleListResponse = v.InferOutput<typeof projectRoleListResponseSchema>
