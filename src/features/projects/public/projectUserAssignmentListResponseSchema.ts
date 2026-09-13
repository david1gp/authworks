import type * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { projectUserAssignmentSchema } from "./projectUserAssignmentSchema.js"

export const projectUserAssignmentListResponseSchema = listResponseSchemaCreate(projectUserAssignmentSchema)

export type ProjectUserAssignmentListResponse = v.InferOutput<typeof projectUserAssignmentListResponseSchema>
