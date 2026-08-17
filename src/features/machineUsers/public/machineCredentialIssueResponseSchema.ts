import * as v from "valibot"
import { machineCredentialSchema } from "./machineCredentialSchema.js"

export const machineCredentialIssueResponseSchema = v.strictObject({
  credential: machineCredentialSchema,
  secret: v.pipe(v.string(), v.minLength(43)),
})

export type MachineCredentialIssueResponse = v.InferOutput<typeof machineCredentialIssueResponseSchema>
