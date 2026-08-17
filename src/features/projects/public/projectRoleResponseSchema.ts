import * as v from "valibot"
import { projectRoleSchema } from "./projectRoleSchema.js"

export const projectRoleResponseSchema = v.strictObject({ role: projectRoleSchema })

export type ProjectRoleResponse = v.InferOutput<typeof projectRoleResponseSchema>
