import * as v from "valibot"
import { machineCredentialKindSchema } from "../domain/machineCredentialKindSchema.js"

export const machineCredentialRotatedEventPayloadSchema = v.strictObject({
  credentialId: v.pipe(v.string(), v.minLength(1)),
  credentialKind: machineCredentialKindSchema,
  replacementCredentialId: v.pipe(v.string(), v.minLength(1)),
})

export type MachineCredentialRotatedEventPayload = v.InferOutput<typeof machineCredentialRotatedEventPayloadSchema>
