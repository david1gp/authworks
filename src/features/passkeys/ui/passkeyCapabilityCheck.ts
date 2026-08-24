/** Checks the browser capabilities required before starting a WebAuthn assertion. */
export function passkeyCapabilityCheck(): boolean {
  return (
    typeof globalThis.PublicKeyCredential !== "undefined" &&
    typeof globalThis.navigator?.credentials?.get === "function"
  )
}
