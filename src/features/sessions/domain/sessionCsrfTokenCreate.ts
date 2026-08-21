import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"

export function sessionCsrfTokenCreate(
  runtime: Pick<ReturnType<typeof runtimeCreate>, "randomBytes"> = runtimeCreate(),
): string {
  return Buffer.from(runtime.randomBytes(32)).toString("base64url")
}
