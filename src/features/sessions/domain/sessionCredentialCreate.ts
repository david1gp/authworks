import type { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"

export function sessionCredentialCreate(runtime: Pick<ReturnType<typeof runtimeCreate>, "randomBytes">): string {
  return Buffer.from(runtime.randomBytes(32)).toString("base64url")
}
