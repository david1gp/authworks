import * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { machineCredentialSchema } from "./machineCredentialSchema.js"

export const machineCredentialListResponseSchema = listResponseSchemaCreate(machineCredentialSchema)

export type MachineCredentialListResponse = v.InferOutput<typeof machineCredentialListResponseSchema>
