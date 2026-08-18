import * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { projectRoleSchema } from "./projectRoleSchema.js"

export const projectRoleListResponseSchema = listResponseSchemaCreate(projectRoleSchema)

export type ProjectRoleListResponse = v.InferOutput<typeof projectRoleListResponseSchema>
