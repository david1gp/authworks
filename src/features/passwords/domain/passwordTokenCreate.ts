import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import { secretGenerate } from "../../../platform/secrets/secretGenerate.js"

export function passwordTokenCreate(runtime: Pick<ReturnType<typeof runtimeCreate>, "randomBytes"> = runtimeCreate()) {
  return secretGenerate(32, runtime)
}
