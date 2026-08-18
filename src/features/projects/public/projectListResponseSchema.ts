import * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { projectSchema } from "./projectSchema.js"

export const projectListResponseSchema = listResponseSchemaCreate(projectSchema)

export type ProjectListResponse = v.InferOutput<typeof projectListResponseSchema>
