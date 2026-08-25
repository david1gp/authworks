import { describe, expect, mock, test } from "bun:test"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
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

describe("account phone-change state", () => {
  test("keeps the verified phone until a valid code applies the returned user", async () => {
    const calls: { name: string; input: unknown }[] = []
    const replacement = "+14155552672"
    const adapter = accountDemoAdapterCreate(() => "success")
    const state = accountPageStateCreate({
      adapter: {
        ...adapter,
        phoneChangeStart: async (input) => {
          calls.push({ input, name: "start" })
          return adapter.phoneChangeStart(input)
        },
        phoneChangeVerify: async (input) => {
          calls.push({ input, name: "verify" })
          return adapter.phoneChangeVerify(input)
        },
      },
      kind: "profile",
    })
    const loaded = await adapter.loadUser()
    if (!loaded.success) throw new Error("Expected demo user")
    state.user.set(loaded.data.user)

    state.phoneCandidate.set(replacement)
    await state.phoneChangeStart(submitEvent)

    expect(state.user.get()?.phoneNumber).toBe(accountDemoUserFixture.phoneNumber)
    expect(state.phoneChallengeId.get()).toBe("account-demo-phone-change")
    expect(calls).toEqual([{ input: { phoneNumber: replacement }, name: "start" }])

    state.phoneCode.set("123456")
    await state.phoneChangeVerify(submitEvent)

    expect(state.user.get()?.phoneNumber).toBe(replacement)
    expect(state.user.get()?.phoneNumberVerifiedAt).toBe(accountDemoUserFixture.updatedAt + 60_000)
    expect(state.phoneStatus.get()).toBe("success")
    expect(calls[1]).toEqual({
      input: { challengeId: "account-demo-phone-change", code: "123456", phoneNumber: replacement },
      name: "verify",
    })
  })

  test("validates inputs before adapter calls and supports deterministic resend", async () => {
    let calls = 0
    const adapter = accountDemoAdapterCreate(() => "success")
    const state = accountPageStateCreate({
      adapter: new Proxy(adapter, {
        get(target, property, receiver) {
          const value = Reflect.get(target, property, receiver)
          if (typeof value !== "function" || !String(property).startsWith("phoneChange")) return value
          return (...input: unknown[]) => {
            calls += 1
            return value.apply(target, input)
          }
        },
      }),
      kind: "profile",
    })

    state.phoneCandidate.set("4155552672")
    await state.phoneChangeStart(submitEvent)
    expect(calls).toBe(0)
    expect(state.phoneValidationMessage.get()).toBe("Enter a valid phone number in E.164 format.")

    state.phoneCandidate.set("+14155552672")
    await state.phoneChangeStart(submitEvent)
    await state.phoneChangeResend()
    expect(calls).toBe(2)
    expect(state.phoneChallengeId.get()).toBe("account-demo-phone-change")

    state.phoneCode.set("123")
    await state.phoneChangeVerify(submitEvent)
    expect(calls).toBe(2)
    expect(state.phoneValidationMessage.get()).toBe("Enter the six-digit verification code.")
  })

  test("keeps phone errors local and the demo adapter network-free", async () => {
    const originalFetch = globalThis.fetch
    let fetchCalled = false
    globalThis.fetch = (() => {
      fetchCalled = true
      return Promise.reject(new Error("Network access is not allowed"))
    }) as unknown as typeof fetch
    try {
      const adapter = accountDemoAdapterCreate(() => "error")
      const state = accountPageStateCreate({ adapter, initialStatus: "ready", kind: "profile" })
      state.phoneCandidate.set("+14155552672")

      await state.phoneChangeStart(submitEvent)

      expect(fetchCalled).toBe(false)
      expect(state.status.get()).toBe("ready")
      expect(state.phoneStatus.get()).toBe("error")
      expect(state.phoneErrorMessage.get()).toBe("The deterministic account fixture is unavailable.")
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
