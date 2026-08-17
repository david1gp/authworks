import * as v from "valibot"
import { machineCredentialSchema } from "./machineCredentialSchema.js"

export const machineCredentialRevokeResponseSchema = v.strictObject({ credential: machineCredentialSchema })

export type MachineCredentialRevokeResponse = v.InferOutput<typeof machineCredentialRevokeResponseSchema>
