import { describe, expect, mock, test } from "bun:test"
import { accountDemoUserFixture } from "../../src/features/account/ui/accountDemoUserFixture.js"

mock.module("solid-js", () => ({
  createSignal: <T>(initial: T) => {
    let value = initial
    return [() => value, (next: T) => (value = next)] as const
  },
  onMount: () => {},
}))

const [{ accountDemoAdapterCreate }, { accountPageStateCreate }] = await Promise.all([
  import("../../src/features/account/ui/accountDemoAdapterCreate.js"),
  import("../../src/features/account/ui/accountPageStateCreate.js"),
])

const submitEvent = { preventDefault: () => {} } as SubmitEvent

describe("account email-change state", () => {
  test("keeps the demo address unchanged until a challenge is verified and consumed", async () => {
    const adapter = accountDemoAdapterCreate(() => "success")
    const state = accountPageStateCreate({ adapter, initialStatus: "ready", kind: "email" })
    const loaded = await adapter.loadUser()
    if (!loaded.success) throw new Error("Expected demo user")
    state.user.set(loaded.data.user)
    state.emailCandidate.set("avery.updated@example.com")

    await state.emailChangeStart(submitEvent)

    expect(state.user.get()?.email).toBe(accountDemoUserFixture.email)
    expect(state.emailChallengeId.get()).toBe("account-demo-email-change")
    expect(state.emailStatus.get()).toBe("code")

    state.emailToken.set("demo-email-change-token-000000000000000000000")
    await state.emailChangeVerify(submitEvent)

    expect(state.user.get()?.email).toBe("avery.updated@example.com")
    expect(state.emailStatus.get()).toBe("success")
    expect(state.emailChallengeId.get()).toBeUndefined()
  })

  test("validates the candidate and token before calling the demo adapter", async () => {
    let starts = 0
    let verifies = 0
    const adapter = accountDemoAdapterCreate(() => "success")
    const state = accountPageStateCreate({
      adapter: {
        ...adapter,
        emailChangeStart: async (input) => {
          starts += 1
          return adapter.emailChangeStart(input)
        },
        emailChangeVerify: async (input) => {
          verifies += 1
          return adapter.emailChangeVerify(input)
        },
      },
      initialStatus: "ready",
      kind: "email",
    })

    state.emailCandidate.set("not-an-email")
    await state.emailChangeStart(submitEvent)
    expect(starts).toBe(0)
    expect(state.emailValidationMessage.get()).toBe("Enter a valid email address.")

    state.emailCandidate.set("avery.updated@example.com")
    await state.emailChangeStart(submitEvent)
    state.emailToken.set("too-short")
    await state.emailChangeVerify(submitEvent)
    expect(starts).toBe(1)
    expect(verifies).toBe(0)
    expect(state.emailValidationMessage.get()).toBe("Enter the verification token from the email.")
  })

  test("the demo challenge rejects replay and mismatched resend requests without network access", async () => {
    const originalFetch = globalThis.fetch
    let fetchCalled = false
    globalThis.fetch = (() => {
      fetchCalled = true
      return Promise.reject(new Error("Network access is not allowed"))
    }) as unknown as typeof fetch
    try {
      const adapter = accountDemoAdapterCreate(() => "success")
      const started = await adapter.emailChangeStart({ email: "avery.updated@example.com" })
      expect(started.success).toBe(true)
      if (!started.success) return
      expect(
        await adapter.emailChangeResend({
          challengeId: started.data.challengeId,
          email: "wrong@example.com",
        }),
      ).toMatchObject({ code: "users.invalid", success: false })
      const verified = await adapter.emailChangeVerify({
        challengeId: started.data.challengeId,
        token: "demo-email-change-token-000000000000000000000",
      })
      expect(verified.success).toBe(true)
      expect(
        await adapter.emailChangeVerify({
          challengeId: started.data.challengeId,
          token: "demo-email-change-token-000000000000000000000",
        }),
      ).toMatchObject({ code: "users.invalid", success: false })
      expect(fetchCalled).toBe(false)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
