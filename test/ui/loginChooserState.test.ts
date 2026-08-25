import { describe, expect, test } from "bun:test"
import { demoLoginBootstrap } from "../../src/features/demo/demoLoginBootstrap.js"
import { loginRecentAccountInitialsGet } from "../../src/features/login/model/loginRecentAccountInitialsGet.js"
import { loginRecentAccountLastUsedMethodGet } from "../../src/features/login/model/loginRecentAccountLastUsedMethodGet.js"

describe("login chooser state", () => {
  test("uses the latest remembered account method without replacing discovery data", () => {
    const accounts = [
      {
        authenticationMethod: "password",
        identifier: "alex@acme.example",
        lastUsedAt: 10,
        sessionId: "session-alex",
      },
      {
        authenticationMethod: "passkey",
        identifier: "sam@acme.example",
        lastUsedAt: 20,
        sessionId: "session-sam",
      },
    ] as const

    expect(accounts.length).toBeGreaterThan(0)
    expect(loginRecentAccountLastUsedMethodGet(accounts)).toBe("passkey")
    expect(demoLoginBootstrap.providers[0]?.displayName).toBe("Google")
  })

  test("derives readable initials from labels with identifier fallback", () => {
    expect(
      loginRecentAccountInitialsGet({
        authenticationMethod: "password",
        identifier: "alex-login",
        label: "Alex Morgan",
        lastUsedAt: 10,
        sessionId: "session-alex",
      }),
    ).toBe("AM")
    expect(
      loginRecentAccountInitialsGet({
        authenticationMethod: "password",
        identifier: "Alice Smith",
        lastUsedAt: 10,
        sessionId: "session-alice",
      }),
    ).toBe("AS")
  })
})
