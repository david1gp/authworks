import * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { realmAdministratorSchema } from "./realmAdministratorSchema.js"

export const realmAdministratorListResponseSchema = listResponseSchemaCreate(realmAdministratorSchema)

export type RealmAdministratorListResponse = v.InferOutput<typeof realmAdministratorListResponseSchema>
