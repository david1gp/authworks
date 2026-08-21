import type { LoginRecentAccount } from "../login/model/loginRecentAccountSchema.js"

const referenceNow = Date.UTC(2026, 7, 21, 9, 30)

export const demoLoginRecentAccounts: readonly LoginRecentAccount[] = [
  {
    authenticationMethod: "password",
    identifier: "alex@acme.example",
    lastUsedAt: referenceNow - 3_600_000,
    sessionId: "demo-session-alex",
  },
  {
    authenticationMethod: "passkey",
    identifier: "sam@acme.example",
    lastUsedAt: referenceNow - 172_800_000,
    sessionId: "demo-session-sam",
  },
]
