import * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { projectListItemSchema } from "./projectListItemSchema.js"

export const projectListResponseSchema = listResponseSchemaCreate(projectListItemSchema)

export type ProjectListResponse = v.InferOutput<typeof projectListResponseSchema>
