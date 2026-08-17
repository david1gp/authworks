import { runtimeCreate } from "../runtime/runtimeCreate.js"
import { Secret } from "./Secret.js"
import { secretCreate } from "./secretCreate.js"

type SecretRuntime = Pick<ReturnType<typeof runtimeCreate>, "randomBytes">

export function secretGenerate(byteLength = 32, runtime: SecretRuntime = runtimeCreate()): Secret {
  if (!Number.isSafeInteger(byteLength) || byteLength <= 0) {
    throw new RangeError("Secret byte length must be a positive safe integer.")
  }

  const bytes = runtime.randomBytes(byteLength)
  if (bytes.length !== byteLength) throw new RangeError("Secret randomness returned an unexpected length.")

  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return secretCreate(btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""))
}
