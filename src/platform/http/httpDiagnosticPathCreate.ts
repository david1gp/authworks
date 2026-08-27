const diagnosticSafeSegments = new Set([
  "account",
  "add",
  "api",
  "authentication-methods",
  "assets",
  "authorize",
  "callback",
  "complete",
  "consents",
  "current",
  "decline",
  "delete",
  "disable",
  "discovery",
  "effective-access",
  "email-otp",
  "emails",
  "enroll",
  "external-identities",
  "external-identity-providers",
  "factors",
  "health",
  "identities",
  "link",
  "login",
  "me",
  "mfa",
  "mfa-policy",
  "organizations",
  "organization-discovery",
  "organization-roles",
  "openid-configuration",
  "passkeys",
  "password",
  "password-policy",
  "phone-change",
  "profile",
  "realms",
  "registration",
  "remove",
  "resend",
  "revoke",
  "rotate",
  "security-history",
  "sessions",
  "start",
  "switch",
  "system",
  "users",
  "verify",
  "verify-email",
  "verify-whatsapp",
  "whatsapp-otp",
  "protected-api",
  "resource",
  "jwks.json",
  "favicon.svg",
])

export function httpDiagnosticPathCreate(input: string | URL): string {
  let url: URL
  try {
    url = typeof input === "string" ? new URL(input, "http://authworks.invalid") : input
  } catch (_error) {
    return "[redacted]"
  }
  const segments = url.pathname.split("/")
  let routeKnown = diagnosticSafeSegments.has(segments.find((segment) => segment.length > 0) ?? "")
  return segments
    .map((segment, index) => {
      if (segment.length === 0) {
        return segment
      }
      if (!routeKnown) return "[redacted]"
      if (diagnosticPathSegmentIsIdentifier(segments, index)) return "[redacted]"
      if (!diagnosticSafeSegments.has(segment)) {
        routeKnown = false
        return "[redacted]"
      }
      return segment
    })
    .join("/")
}

function diagnosticPathSegmentIsIdentifier(segments: readonly string[], index: number): boolean {
  const previous = segments[index - 1]
  if (previous === "realms") return true
  if (previous !== undefined && diagnosticIdentifierParents.has(previous)) {
    if (diagnosticStaticRouteSegmentsAfterParent.get(previous)?.has(segments[index] ?? "") === true) return false
    return true
  }
  return false
}

const diagnosticIdentifierParents = new Set([
  "clients",
  "consents",
  "external-identity-providers",
  "external-identities",
  "organizations",
  "passkeys",
  "projects",
  "realms",
  "refresh-tokens",
  "sessions",
  "signing-keys",
  "users",
])

const diagnosticStaticRouteSegmentsAfterParent = new Map([
  ["sessions", new Set(["csrf", "current", "logout", "recent", "rotate"])],
  ["refresh-tokens", new Set(["revoke-all"])],
])
