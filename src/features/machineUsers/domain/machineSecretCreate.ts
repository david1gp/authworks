import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"

type MachineSecretRuntime = Pick<ReturnType<typeof runtimeCreate>, "randomBytes">

export function machineSecretCreate(runtime: MachineSecretRuntime = runtimeCreate()): Result<string> {
  const op = "machineSecretCreate"
  try {
    const bytes = runtime.randomBytes(32)
    if (bytes.length !== 32) return resultErrorCreate(op, "The machine secret could not be generated.")
    return resultCreate(Buffer.from(bytes).toString("base64url"))
  } catch (_error) {
    return resultErrorCreate(op, "The machine secret could not be generated.")
  }
}
