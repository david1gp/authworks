import { scryptSync } from "node:crypto"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"

type MachineSecretHashRuntime = Pick<ReturnType<typeof runtimeCreate>, "randomBytes">

export function machineSecretHashCreate(
  secret: string,
  runtime: MachineSecretHashRuntime = runtimeCreate(),
): Result<string> {
  const op = "machineSecretHashCreate"
  try {
    const salt = Buffer.from(runtime.randomBytes(16))
    if (salt.length !== 16)
      return resultErrorCreate(op, "The machine secret could not be hashed.", "machine-users.invalid")
    const hash = scryptSync(secret, salt, 32, { maxmem: 32 * 1024 * 1024, N: 16_384, p: 1, r: 8 })
    return resultCreate(`scrypt$16384$8$1$${salt.toString("base64url")}$${Buffer.from(hash).toString("base64url")}`)
  } catch (_error) {
    return resultErrorCreate(op, "The machine secret could not be hashed.", "machine-users.invalid")
  }
}
