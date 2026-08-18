import * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { projectGrantSchema } from "./projectGrantSchema.js"

export const projectGrantListResponseSchema = listResponseSchemaCreate(projectGrantSchema)

export type ProjectGrantListResponse = v.InferOutput<typeof projectGrantListResponseSchema>
