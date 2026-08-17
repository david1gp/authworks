import * as v from "valibot"
import { machineScopeSchema } from "../domain/machineScopeSchema.js"

const machineCredentialUserIdSchema = v.pipe(
  v.string(),
  v.regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
)

export const machineCredentialIssueRequestSchema = v.strictObject({
  expiresAt: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  machineUserId: machineCredentialUserIdSchema,
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  scopes: v.optional(v.pipe(v.array(machineScopeSchema), v.maxLength(100))),
})

export type MachineCredentialIssueRequest = v.InferOutput<typeof machineCredentialIssueRequestSchema>
