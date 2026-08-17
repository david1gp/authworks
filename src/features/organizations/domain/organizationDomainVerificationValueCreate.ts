import type { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"

export function organizationDomainVerificationValueCreate(
  runtime: Pick<ReturnType<typeof runtimeCreate>, "randomBytes">,
): string {
  const bytes = runtime.randomBytes(32)
  return `zitadel-domain-verification=${Buffer.from(bytes).toString("base64url")}`
}
