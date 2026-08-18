import * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { realmSchema } from "./realmSchema.js"

export const realmListResponseSchema = listResponseSchemaCreate(realmSchema)

export type RealmListResponse = v.InferOutput<typeof realmListResponseSchema>
