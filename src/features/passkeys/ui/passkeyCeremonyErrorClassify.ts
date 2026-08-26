import { englishCatalog } from "../../../ui/i18n/model/englishCatalog.js"
import type { PasskeyAuthenticationStatus } from "../public/passkeyAuthenticationStatusSchema.js"

/** Maps browser WebAuthn failures to safe, retryable login states without exposing native details. */
export function passkeyCeremonyErrorClassify(error: unknown): {
  readonly message: string
  readonly status: Extract<PasskeyAuthenticationStatus, "permission-denied" | "ceremony-failure">
} {
  const name = passkeyCeremonyErrorNameGet(error)
  if (name === "NotAllowedError" || name === "AbortError")
    return { message: englishCatalog["login.passkey.canceled"], status: "ceremony-failure" }
  if (name === "SecurityError")
    return { message: englishCatalog["login.passkey.ceremonyFailure"], status: "ceremony-failure" }
  if (name === "NotSupportedError" || name === "InvalidStateError")
    return { message: englishCatalog["login.passkey.ceremonyFailure"], status: "ceremony-failure" }
  return { message: englishCatalog["login.passkey.ceremonyFailure"], status: "ceremony-failure" }
}

function passkeyCeremonyErrorNameGet(error: unknown): string | undefined {
  if (error === null || typeof error !== "object" || !("name" in error)) return undefined
  return typeof error.name === "string" ? error.name : undefined
}
