import * as v from "valibot"
import { machineCredentialKindSchema } from "../public/machineCredentialKindSchema.js"

export const machineCredentialRevokedEventPayloadSchema = v.strictObject({
  credentialId: v.pipe(v.string(), v.minLength(1)),
  credentialKind: machineCredentialKindSchema,
})

export type MachineCredentialRevokedEventPayload = v.InferOutput<typeof machineCredentialRevokedEventPayloadSchema>
