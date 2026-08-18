import * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { projectApplicationSchema } from "./projectApplicationSchema.js"

export const projectApplicationListResponseSchema = listResponseSchemaCreate(projectApplicationSchema)

export type ProjectApplicationListResponse = v.InferOutput<typeof projectApplicationListResponseSchema>
