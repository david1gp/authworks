import type { PasskeyAuthenticationStatus } from "../public/passkeyAuthenticationStatusSchema.js"

/** Maps browser WebAuthn failures to safe, retryable login states without exposing native details. */
export function passkeyCeremonyErrorClassify(error: unknown): {
  readonly message: string
  readonly status: Extract<PasskeyAuthenticationStatus, "permission-denied" | "ceremony-failure">
} {
  const name = passkeyCeremonyErrorNameGet(error)
  if (name === "NotAllowedError" || name === "AbortError")
    return { message: "Passkey sign-in was canceled or timed out.", status: "permission-denied" }
  if (name === "SecurityError")
    return { message: "Passkey sign-in could not be completed in this browser context.", status: "ceremony-failure" }
  if (name === "NotSupportedError" || name === "InvalidStateError")
    return { message: "This passkey is not supported or registered on this device.", status: "ceremony-failure" }
  return { message: "Passkey sign-in could not be completed. Please try again.", status: "ceremony-failure" }
}

function passkeyCeremonyErrorNameGet(error: unknown): string | undefined {
  if (error === null || typeof error !== "object" || !("name" in error)) return undefined
  return typeof error.name === "string" ? error.name : undefined
}
