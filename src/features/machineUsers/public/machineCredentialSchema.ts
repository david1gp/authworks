import * as v from "valibot"
import { machineCredentialKindSchema } from "../domain/machineCredentialKindSchema.js"
import { machineScopeSchema } from "../domain/machineScopeSchema.js"

const machineCredentialIdSchema = v.pipe(
  v.string(),
  v.regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
)

export const machineCredentialSchema = v.strictObject({
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  expiresAt: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  id: machineCredentialIdSchema,
  instanceId: machineCredentialIdSchema,
  kind: machineCredentialKindSchema,
  machineUserId: machineCredentialIdSchema,
  name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
  revokedAt: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  scopes: v.pipe(v.array(machineScopeSchema), v.maxLength(100)),
})

export type MachineCredential = v.InferOutput<typeof machineCredentialSchema>
