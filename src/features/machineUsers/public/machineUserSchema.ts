import * as v from "valibot"
import { machineScopeSchema } from "../domain/machineScopeSchema.js"
import { machineUserStatusSchema } from "../domain/machineUserStatusSchema.js"

const machineUserIdSchema = v.pipe(
  v.string(),
  v.regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
)

export const machineUserSchema = v.strictObject({
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  displayName: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  id: machineUserIdSchema,
  realmId: machineUserIdSchema,
  scopes: v.pipe(v.array(machineScopeSchema), v.maxLength(100)),
  status: machineUserStatusSchema,
  updatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  userName: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
})

export type MachineUser = v.InferOutput<typeof machineUserSchema>
