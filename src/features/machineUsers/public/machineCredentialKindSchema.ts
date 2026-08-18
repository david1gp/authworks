import * as v from "valibot"

export const machineCredentialKindSchema = v.picklist([
  "client_secret",
  "personal_access_token",
  "api_key",
  "access_token",
])

export type MachineCredentialKind = v.InferOutput<typeof machineCredentialKindSchema>
