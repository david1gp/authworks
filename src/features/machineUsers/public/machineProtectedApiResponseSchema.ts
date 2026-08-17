import * as v from "valibot"
import { authorizationActorContextSchema } from "../../authorization/public/authorizationActorContextSchema.js"
import { machineCredentialSchema } from "./machineCredentialSchema.js"
import { machineUserSchema } from "./machineUserSchema.js"

export const machineProtectedApiResponseSchema = v.object({
  actor: authorizationActorContextSchema,
  credential: machineCredentialSchema,
  machineUser: machineUserSchema,
  scopes: v.array(v.pipe(v.string(), v.minLength(1))),
})

export type MachineProtectedApiResponse = v.InferOutput<typeof machineProtectedApiResponseSchema>
