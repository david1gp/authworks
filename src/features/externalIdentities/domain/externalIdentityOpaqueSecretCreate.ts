import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"

export function externalIdentityOpaqueSecretCreate(
  runtime: Pick<ReturnType<typeof runtimeCreate>, "randomBytes">,
  byteLength = 32,
): string {
  const bytes = runtime.randomBytes(byteLength)
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")
}
