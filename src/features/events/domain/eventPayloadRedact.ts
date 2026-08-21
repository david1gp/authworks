export function eventPayloadRedact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(eventPayloadRedact)
  if (value === null || typeof value !== "object") return value

  const redacted: Record<string, unknown> = {}
  for (const [key, nestedValue] of Object.entries(value)) {
    redacted[key] = eventPayloadKeyIsSensitive(key) ? "[REDACTED]" : eventPayloadRedact(nestedValue)
  }
  return redacted
}

function eventPayloadKeyIsSensitive(key: string): boolean {
  const normalized = key
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .toLowerCase()
  if (
    [
      "authorization",
      "code",
      "cookie",
      "credential",
      "credential_value",
      "csrf",
      "otp",
      "password",
      "passphrase",
      "secret",
      "signature",
      "totp",
    ].includes(normalized)
  )
    return true
  return (
    [
      "api_key",
      "authorization_code",
      "bearer",
      "client_secret",
      "private_key",
      "private_key_jwk",
      "password_value",
      "recovery_code",
      "secret_hash",
      "secret_value",
      "token",
      "token_value",
      "verification_code",
    ].some((sensitiveKey) => normalized === sensitiveKey || normalized.endsWith(`_${sensitiveKey}`)) ||
    (normalized.endsWith("_hash") &&
      ["secret", "token", "password"].some((sensitiveKey) => normalized.startsWith(`${sensitiveKey}_`)))
  )
}
