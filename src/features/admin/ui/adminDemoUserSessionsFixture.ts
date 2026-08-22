import type { Session } from "../../sessions/public/sessionSchema.js"

const now = Date.UTC(2026, 7, 21, 9, 30)

/** Safe, deterministic device/session metadata for the administrator demo. */
export const adminDemoUserSessionsFixture: readonly Session[] = [
  {
    assurance: "multi_factor",
    authenticationMethod: "password",
    createdAt: now - 86_400_000,
    current: false,
    device: { description: "Firefox on Linux", ipAddress: "192.0.2.10" },
    expiresAt: now + 86_400_000,
    id: "session-admin-desktop",
    lastUsedAt: now - 60_000,
    mfaMethod: "totp",
    realmId: "01900000-0000-7000-8000-000000000001",
    revokedAt: null,
    subjectId: "01900000-0000-7000-8000-000000000021",
    subjectType: "user",
    userId: "01900000-0000-7000-8000-000000000021",
  },
  {
    assurance: "authenticated",
    authenticationMethod: "passkey",
    createdAt: now - 604_800_000,
    current: false,
    device: { description: "Safari on iPhone", ipAddress: "198.51.100.24" },
    expiresAt: now + 3_600_000,
    id: "session-admin-mobile",
    lastUsedAt: now - 7_200_000,
    realmId: "01900000-0000-7000-8000-000000000001",
    revokedAt: null,
    subjectId: "01900000-0000-7000-8000-000000000021",
    subjectType: "user",
    userId: "01900000-0000-7000-8000-000000000021",
  },
]
