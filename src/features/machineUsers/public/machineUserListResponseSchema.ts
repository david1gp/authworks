import * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { machineUserSchema } from "./machineUserSchema.js"

export const machineUserListResponseSchema = listResponseSchemaCreate(machineUserSchema)

export type MachineUserListResponse = v.InferOutput<typeof machineUserListResponseSchema>
