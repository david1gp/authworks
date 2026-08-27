import { afterEach, describe, expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { resultErrorCodedCreate } from "../../src/platform/errors/resultErrorCodedCreate.js"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
import { accountDemoUserFixture } from "../../src/features/account/ui/accountDemoUserFixture.js"
import { accountDemoAdapterCreate } from "../../src/features/account/ui/accountDemoAdapterCreate.js"
import { accountPageStateCreate } from "../../src/features/account/ui/accountPageStateCreate.js"

const cleanups: (() => void)[] = []

const submitEvent = { preventDefault: () => {} } as SubmitEvent

afterEach(async () => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
  for (const cleanup of cleanups.splice(0)) cleanup()
})

describe("account phone-change state", () => {
  test("submits gender without the picture and uploads or removes the picture separately", async () => {
    const adapter = accountDemoAdapterCreate(() => "success")
    let submitted: Record<string, unknown> = {}
    const state = stateCreate({
      adapter: {
        ...adapter,
        updateProfile: async (input) => {
          submitted = input
          return adapter.updateProfile(input)
        },
      },
      initialStatus: "ready",
      kind: "profile",
    })
    const loaded = await adapter.loadUser()
    if (!loaded.success) throw new Error("Expected demo user")
    state.user.set(loaded.data.user)
    state.displayName.set("Avery Updated")
    state.gender.set("woman")

    await state.profileSubmit(submitEvent)

    expect(state.user.get()?.profile.gender).toBe("woman")
    expect(Object.hasOwn(submitted, "picture")).toBe(false)

    await state.pictureUpload(new File([new Uint8Array([1])], "avatar.webp", { type: "image/webp" }))
    expect(state.pictureStatus.get()).toBe("success")
    expect(state.pictureUrl.get()).toContain("avery.stone_demo.webp")
    expect(state.user.get()?.profile.picture?.contentType).toBe("image/webp")

    await state.pictureRemove()
    expect(state.pictureStatus.get()).toBe("success")
    expect(state.pictureUrl.get()).toBe("")
    expect(state.user.get()?.profile.picture).toBeUndefined()
  })

  test("rejects an unsupported or oversized picture before calling the adapter", async () => {
    const adapter = accountDemoAdapterCreate(() => "success")
    let uploads = 0
    const state = stateCreate({
      adapter: {
        ...adapter,
        profilePictureUpload: async (file) => {
          uploads += 1
          return adapter.profilePictureUpload(file)
        },
      },
      initialStatus: "ready",
      kind: "profile",
    })

    await state.pictureUpload(new File([new Uint8Array([1])], "avatar.svg", { type: "image/svg+xml" }))
    expect(uploads).toBe(0)
    expect(state.pictureStatus.get()).toBe("error")
    expect(state.pictureErrorMessage.get()).toBe("Choose a JPEG, PNG, WebP, or GIF image.")

    await state.pictureUpload(new File([new Uint8Array(512 * 1024 + 1)], "avatar.png", { type: "image/png" }))
    expect(uploads).toBe(0)
    expect(state.pictureErrorMessage.get()).toBe("Choose an image of at most 512 KiB.")
  })

  test("does not replace general profile validation with picture feedback", async () => {
    const adapter = accountDemoAdapterCreate(() => "success")
    const updateProfile = adapter.updateProfile
    let submittedGender = ""
    const state = stateCreate({
      adapter: {
        ...adapter,
        updateProfile: async (input) => {
          submittedGender = input.gender ?? ""
          return updateProfile(input)
        },
      },
      initialStatus: "ready",
      kind: "profile",
    })
    state.displayName.set("Avery Updated")
    state.gender.set("x".repeat(65))

    await state.profileSubmit(submitEvent)

    expect(submittedGender).toBe("x".repeat(65))
    expect(state.validationMessage.get()).toBeUndefined()
    expect(state.status.get()).toBe("success")
  })

  test("keeps the verified phone until a valid code applies the returned user", async () => {
    const calls: { name: string; input: unknown }[] = []
    const replacement = "+14155552672"
    const adapter = accountDemoAdapterCreate(() => "success")
    const state = stateCreate({
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

  test("clears phone-change state after a successful user reload", async () => {
    const refreshedUser = { ...accountDemoUserFixture, phoneNumber: "+14155552672" }
    const adapter = accountDemoAdapterCreate(() => "success")
    const state = stateCreate({
      adapter: {
        ...adapter,
        loadUser: async () => resultCreate({ user: refreshedUser }),
      },
      initialStatus: "ready",
      kind: "profile",
    })

    state.phoneCandidate.set("+14155550000")
    state.phoneChallengeId.set("stale-challenge")
    state.phoneCode.set("123456")
    state.phoneErrorMessage.set("stale error")
    state.phoneValidationMessage.set("stale validation")
    state.phoneStatus.set("code")

    await state.load(true)

    expect(state.user.get()?.phoneNumber).toBe(refreshedUser.phoneNumber)
    expect(state.phoneCandidate.get()).toBe("")
    expect(state.phoneChallengeId.get()).toBeUndefined()
    expect(state.phoneCode.get()).toBe("")
    expect(state.phoneErrorMessage.get()).toBeUndefined()
    expect(state.phoneValidationMessage.get()).toBeUndefined()
    expect(state.phoneStatus.get()).toBe("idle")
  })

  test("validates inputs before adapter calls and supports deterministic resend", async () => {
    let calls = 0
    const adapter = accountDemoAdapterCreate(() => "success")
    const state = stateCreate({
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
      const state = stateCreate({ adapter, initialStatus: "ready", kind: "profile" })
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

  test("routes phone session failures through account expiry handling", async () => {
    const sessionExpired = () => {
      const result = resultErrorCodedCreate("phoneChange", "Session expired.", "sessions.unauthorized")
      result.statusCode = 401
      return result
    }
    const adapter = accountDemoAdapterCreate(() => "success")
    const expiredAdapter = {
      ...adapter,
      phoneChangeResend: async () => sessionExpired(),
      phoneChangeStart: async () => sessionExpired(),
      phoneChangeVerify: async () => sessionExpired(),
    }

    const startState = stateCreate({ adapter: expiredAdapter, initialStatus: "ready", kind: "profile" })
    startState.phoneCandidate.set("+14155552672")
    await startState.phoneChangeStart(submitEvent)
    expect(startState.status.get()).toBe("expired")

    const resendState = stateCreate({ adapter: expiredAdapter, initialStatus: "ready", kind: "profile" })
    resendState.phoneCandidate.set("+14155552672")
    resendState.phoneChallengeId.set("challenge")
    await resendState.phoneChangeResend()
    expect(resendState.status.get()).toBe("expired")

    const verifyState = stateCreate({ adapter: expiredAdapter, initialStatus: "ready", kind: "profile" })
    verifyState.phoneCandidate.set("+14155552672")
    verifyState.phoneChallengeId.set("challenge")
    verifyState.phoneCode.set("123456")
    await verifyState.phoneChangeVerify(submitEvent)
    expect(verifyState.status.get()).toBe("expired")
  })
})

function stateCreate(options: Parameters<typeof accountPageStateCreate>[0]) {
  let dispose: (() => void) | undefined
  const state = createRoot((rootDispose) => {
    dispose = rootDispose
    return accountPageStateCreate({ ...options, initialStatus: "loading" })
  })
  if (dispose === undefined) throw new Error("Account page state root did not provide a disposer.")
  if (options.initialStatus !== undefined && options.initialStatus !== "loading")
    state.status.set(options.initialStatus)
  cleanups.push(dispose)
  return state
}
