import * as v from "valibot"
import { machineCredentialSchema } from "./machineCredentialSchema.js"

export const machineCredentialListResponseSchema = v.strictObject({ credentials: v.array(machineCredentialSchema) })

export type MachineCredentialListResponse = v.InferOutput<typeof machineCredentialListResponseSchema>
