import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from "bun:test"
import { Window } from "happy-dom"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { DemoFixtureState } from "../../demo/demoFixtureStateSchema.js"
import { demoLoginBootstrap } from "../../demo/demoLoginBootstrap.js"
import type { LoginScreen } from "../model/loginScreenSchema.js"
import type { LoginAdapter, LoginDiscovery } from "./loginAdapter.js"
import { loginDemoAdapterCreate } from "./loginDemoAdapterCreate.js"

type LoginPageStateCreate = typeof import("./loginPageStateCreate.js")["loginPageStateCreate"]

const solidRuntimePath = "../../../../node_modules/solid-js/dist/dev.js"
const solidWebRuntimePath = "../../../../node_modules/solid-js/web/dist/web.js"
mock.module("solid-js", () => import(solidRuntimePath))
mock.module("solid-js/web", () => import(solidWebRuntimePath))

let createRoot: typeof import("solid-js").createRoot
let createSignal: typeof import("solid-js").createSignal
let loginPageStateCreate: LoginPageStateCreate

beforeAll(async () => {
  const solid = await import("solid-js")
  createRoot = solid.createRoot
  createSignal = solid.createSignal
  loginPageStateCreate = (await import("./loginPageStateCreate.js")).loginPageStateCreate
})

afterAll(() => mock.restore())

const globalValues = globalThis as unknown as Record<string, unknown>
const previousGlobals = new Map<string, unknown>()
const cleanups: Array<() => void> = []

const flushEffects = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const stateCreate = (
  route: () => LoginScreen,
  initialStatus?: "loading" | "ready",
  onResume: () => void = () => {},
  fixtureState: DemoFixtureState = "success",
  adapterOverrides: Partial<LoginAdapter> = {},
  initialDiscovery: LoginDiscovery = demoLoginBootstrap,
  onNavigate: (path: string) => void = () => {},
) => {
  const browserWindow = new Window()
  previousGlobals.set("document", globalValues.document)
  previousGlobals.set("window", globalValues.window)
  globalValues.document = browserWindow.document
  globalValues.window = browserWindow

  let dispose: (() => void) | undefined
  const state = createRoot((rootDispose) => {
    dispose = rootDispose
    return loginPageStateCreate({
      adapter: {
        ...loginDemoAdapterCreate({ fixtureState: () => fixtureState, onResume }),
        ...adapterOverrides,
      },
      basePath: "/demo/login",
      initialDiscovery: initialStatus === "loading" ? undefined : () => initialDiscovery,
      initialStatus: initialStatus === undefined ? () => "ready" : () => initialStatus,
      navigate: onNavigate,
      screen: route,
    })
  })
  cleanups.push(() => {
    dispose?.()
    for (const name of ["document", "window"] as const) {
      const previous = previousGlobals.get(name)
      if (previous === undefined) delete globalValues[name]
      else globalValues[name] = previous
    }
    previousGlobals.clear()
  })
  return state
}

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

describe("loginPageStateCreate lifecycle focus", () => {
  test("keeps an immediate screen transition while the route still reports the old screen", async () => {
    const [route, routeSet] = createSignal<LoginScreen>("chooser")
    const state = stateCreate(route)
    await flushEffects()

    state.go("password")
    expect(state.screen()).toBe("password")

    routeSet("email-otp")
    await flushEffects()
    expect(state.screen()).toBe("password")

    routeSet("password")
    await flushEffects()
    expect(state.screen()).toBe("password")
  })

  test("focuses each email OTP screen once from the active screen", async () => {
    const [route] = createSignal<LoginScreen>("chooser")
    const state = stateCreate(route)
    const emailInput = document.createElement("input")
    const codeInput = document.createElement("input")
    document.body.append(emailInput, codeInput)
    let emailFocusCount = 0
    let codeFocusCount = 0
    const emailFocus = emailInput.focus.bind(emailInput)
    const codeFocus = codeInput.focus.bind(codeInput)
    emailInput.focus = () => {
      emailFocusCount += 1
      emailFocus()
    }
    codeInput.focus = () => {
      codeFocusCount += 1
      codeFocus()
    }
    state.emailOtpEmailInputRegister(emailInput)
    state.emailOtpCodeInputRegister(codeInput)
    await flushEffects()

    state.go("email-otp")
    await flushEffects()
    expect(emailFocusCount).toBe(1)
    state.go("email-otp")
    await flushEffects()
    expect(emailFocusCount).toBe(1)

    state.go("email-otp-code")
    await flushEffects()
    expect(codeFocusCount).toBe(1)
    state.go("email-otp-code")
    await flushEffects()
    expect(codeFocusCount).toBe(1)
  })

  test("focuses the lifecycle heading once for a loading status", async () => {
    const [route] = createSignal<LoginScreen>("chooser")
    const state = stateCreate(route, "loading")
    const heading = document.createElement("h1")
    document.body.append(heading)
    let focusCount = 0
    const focus = heading.focus.bind(heading)
    heading.focus = () => {
      focusCount += 1
      focus()
    }
    state.lifecycleHeadingRegister(heading)

    await flushEffects()
    expect(focusCount).toBe(1)
    state.go("password")
    await flushEffects()
    expect(focusCount).toBe(1)
  })

  test("renders signed-in after a pending password submission navigates synchronously", async () => {
    const [route, routeSet] = createSignal<LoginScreen>("password")
    const state = stateCreate(route, "ready", () => routeSet("signed-in"))
    state.identifier.set("alex@acme.example")
    state.password.set("demo-password")

    const submission = state.passwordSubmit({ preventDefault: () => {} } as SubmitEvent)
    expect(state.pending()).toBe(true)
    expect(state.screen()).toBe("password")

    await submission
    await flushEffects()

    expect(route()).toBe("signed-in")
    expect(state.screen()).toBe("signed-in")
    expect(state.pending()).toBe(false)
  })

  test("resumes a selected recent account and completes the current flow", async () => {
    const [route, routeSet] = createSignal<LoginScreen>("chooser")
    const state = stateCreate(route, "ready", () => routeSet("signed-in"))
    await flushEffects()

    const selecting = state.recentAccountSelect({
      authenticationMethod: "password",
      identifier: "alex@acme.example",
      label: "Alex Morgan",
      lastUsedAt: 10,
      sessionId: "session-alex",
    })
    expect(state.pending()).toBe(true)
    await selecting
    await flushEffects()

    expect(state.identifier.get()).toBe("alex@acme.example")
    expect(route()).toBe("signed-in")
    expect(state.screen()).toBe("signed-in")
  })

  test("keeps the selected identifier and falls back to password when resume fails", async () => {
    const [route] = createSignal<LoginScreen>("chooser")
    const state = stateCreate(route, "ready", undefined, "error")
    await flushEffects()

    const selecting = state.recentAccountSelect({
      authenticationMethod: "password",
      identifier: "alex@acme.example",
      label: "Alex Morgan",
      lastUsedAt: 10,
      sessionId: "session-alex",
    })
    await selecting

    expect(state.identifier.get()).toBe("alex@acme.example")
    expect(state.screen()).toBe("password")
    expect(state.pending()).toBe(false)
  })

  test("starts, resends, validates, and verifies a WhatsApp code through the adapter", async () => {
    const [route, routeSet] = createSignal<LoginScreen>("whatsapp-otp")
    let startedPhoneNumber = ""
    let resentChallengeId = ""
    let verifiedCode = ""
    let resumed = 0
    const state = stateCreate(
      route,
      "ready",
      () => {
        resumed += 1
      },
      "success",
      {
        whatsappOtpAvailable: () => true,
        whatsappOtpResend: async (challengeId) => {
          resentChallengeId = challengeId
          return resultCreate({ accepted: true, challengeId: "wa-challenge-2", expiresAt: 0, retryAt: 0 })
        },
        whatsappOtpStart: async (phoneNumber) => {
          startedPhoneNumber = phoneNumber
          return resultCreate({ accepted: true, challengeId: "wa-challenge-1", expiresAt: 0, retryAt: 0 })
        },
        whatsappOtpVerify: async (challengeId, code) => {
          expect(challengeId).toBe("wa-challenge-2")
          verifiedCode = code
          return resultCreate({ userId: "wa-user" })
        },
      },
    )
    await flushEffects()

    state.phoneNumber.set("14155552671")
    await state.whatsappOtpSubmit({ preventDefault: () => {} } as SubmitEvent)
    expect(state.whatsappOtpPhoneNumberValid()).toBe(false)
    expect(state.validationMessage()).toBe("Enter a valid phone number in E.164 format.")
    expect(startedPhoneNumber).toBe("")

    state.phoneNumber.set(" +14155552671 ")
    expect(state.whatsappOtpPhoneNumberValid()).toBe(true)
    await state.whatsappOtpSubmit({ preventDefault: () => {} } as SubmitEvent)
    expect(startedPhoneNumber).toBe("+14155552671")
    expect(state.screen()).toBe("whatsapp-otp-code")
    routeSet("whatsapp-otp-code")

    state.whatsappOtpCodeSet("654321")
    await state.whatsappOtpResend()
    expect(resentChallengeId).toBe("wa-challenge-1")
    expect(state.code.get()).toBe("")
    state.whatsappOtpCodeSet("12x3456")
    expect(state.code.get()).toBe("123456")
    expect(state.whatsappOtpCodeValid()).toBe(true)
    await state.whatsappOtpSubmit({ preventDefault: () => {} } as SubmitEvent)
    expect(verifiedCode).toBe("123456")
    expect(resumed).toBe(1)
  })

  test("starts a WhatsApp resend cooldown from a rate-limit retry header", async () => {
    const [route] = createSignal<LoginScreen>("whatsapp-otp")
    const rateLimited = resultErrorCodedCreate("whatsappOtpResend", "Too many requests.", "platform.rate-limited", {
      retryAfter: "23",
    })
    rateLimited.statusCode = 429
    const state = stateCreate(route, "ready", undefined, "success", {
      whatsappOtpResend: async () => rateLimited,
      whatsappOtpStart: async () =>
        resultCreate({ accepted: true, challengeId: "wa-challenge-1", expiresAt: 0, retryAt: 0 }),
    })
    await flushEffects()

    state.phoneNumber.set("+14155552671")
    await state.whatsappOtpSubmit({ preventDefault: () => {} } as SubmitEvent)
    state.whatsappOtpCodeSet("654321")
    await state.whatsappOtpResend()

    expect(state.whatsappOtpResendCountdown()).toBeGreaterThan(0)
    expect(state.whatsappOtpResendAllowed()).toBe(false)
    expect(state.code.get()).toBe("654321")
    expect(state.errorMessage()).toBe("Too many requests.")
  })

  test("keeps the phone and blocks WhatsApp start while rate-limited", async () => {
    let startCount = 0
    const rateLimited = resultErrorCodedCreate("whatsappOtpStart", "Too many requests.", "platform.rate-limited", {
      retryAfterSeconds: "23",
    })
    rateLimited.statusCode = 429
    const state = stateCreate(createSignal<LoginScreen>("whatsapp-otp")[0], "ready", undefined, "success", {
      whatsappOtpStart: async () => {
        startCount += 1
        return rateLimited
      },
    })
    await flushEffects()

    state.phoneNumber.set(" +14155552671 ")
    await state.whatsappOtpSubmit({ preventDefault: () => {} } as SubmitEvent)
    await state.whatsappOtpSubmit({ preventDefault: () => {} } as SubmitEvent)

    expect(startCount).toBe(1)
    expect(state.phoneNumber.get()).toBe("+14155552671")
    expect(state.whatsappOtpStartRetryCountdown()).toBeGreaterThan(0)
    expect(state.whatsappOtpStartAllowed()).toBe(false)
    expect(state.errorMessage()).toBe("Too many requests.")
  })

  test("keeps the code and blocks WhatsApp verify while rate-limited", async () => {
    let verifyCount = 0
    const rateLimited = resultErrorCodedCreate("whatsappOtpVerify", "Too many requests.", "whatsapp-otp.rate-limited", {
      retryAfter: "19",
    })
    rateLimited.statusCode = 429
    const [route, routeSet] = createSignal<LoginScreen>("whatsapp-otp")
    const state = stateCreate(route, "ready", undefined, "success", {
      whatsappOtpStart: async () =>
        resultCreate({ accepted: true, challengeId: "wa-challenge-1", expiresAt: 0, retryAt: 0 }),
      whatsappOtpVerify: async () => {
        verifyCount += 1
        return rateLimited
      },
    })
    await flushEffects()

    state.phoneNumber.set("+14155552671")
    await state.whatsappOtpSubmit({ preventDefault: () => {} } as SubmitEvent)
    routeSet("whatsapp-otp-code")
    await flushEffects()
    state.whatsappOtpCodeSet("654321")
    await state.whatsappOtpSubmit({ preventDefault: () => {} } as SubmitEvent)
    await state.whatsappOtpSubmit({ preventDefault: () => {} } as SubmitEvent)

    expect(verifyCount).toBe(1)
    expect(state.code.get()).toBe("654321")
    expect(state.whatsappOtpVerifyRetryCountdown()).toBeGreaterThan(0)
    expect(state.whatsappOtpVerifyAllowed()).toBe(false)
    expect(state.errorMessage()).toBe("Too many requests.")
  })

  test("refreshes WhatsApp availability when returning to the method chooser", async () => {
    const [route] = createSignal<LoginScreen>("password")
    let available = true
    let discoveryCount = 0
    const state = stateCreate(route, "ready", undefined, "success", {
      discover: async () => {
        discoveryCount += 1
        available = discoveryCount !== 1
        return resultCreate(demoLoginBootstrap)
      },
      whatsappOtpAvailable: () => available,
    })
    await flushEffects()

    expect(state.methods()).toContain("whatsapp-otp")
    state.go("chooser")
    await flushEffects()
    expect(state.methods()).not.toContain("whatsapp-otp")
    state.go("password")
    state.go("chooser")
    await flushEffects()
    expect(state.methods()).toContain("whatsapp-otp")
  })

  test("returns direct WhatsApp routes to the chooser when policy disables an available method", async () => {
    for (const routeScreen of ["whatsapp-otp", "whatsapp-otp-code"] as const) {
      const [route] = createSignal<LoginScreen>(routeScreen)
      const navigated: string[] = []
      const state = stateCreate(
        route,
        "ready",
        undefined,
        "success",
        { whatsappOtpAvailable: () => true },
        { ...demoLoginBootstrap, policy: { ...demoLoginBootstrap.policy, allowWhatsappOtp: false } },
        (path) => navigated.push(path),
      )
      await flushEffects()

      expect(state.screen()).toBe("chooser")
      expect(navigated).toEqual(["/demo/login/chooser"])
    }
  })

  test("keeps direct WhatsApp routes usable when policy and availability allow them", async () => {
    for (const routeScreen of ["whatsapp-otp", "whatsapp-otp-code"] as const) {
      const [route] = createSignal<LoginScreen>(routeScreen)
      const navigated: string[] = []
      const state = stateCreate(
        route,
        "ready",
        undefined,
        "success",
        { whatsappOtpAvailable: () => true },
        demoLoginBootstrap,
        (path) => navigated.push(path),
      )
      await flushEffects()

      expect(state.screen()).toBe(routeScreen)
      expect(navigated).toEqual([])
    }
  })

  test("refreshes WhatsApp availability before gating a browser-history transition", async () => {
    const [route, routeSet] = createSignal<LoginScreen>("chooser")
    const navigated: string[] = []
    let available = true
    let discoveryCount = 0
    const state = stateCreate(
      route,
      "ready",
      undefined,
      "success",
      {
        discover: async () => {
          discoveryCount += 1
          available = discoveryCount !== 1
          return resultCreate(demoLoginBootstrap)
        },
        whatsappOtpAvailable: () => available,
      },
      demoLoginBootstrap,
      (path) => navigated.push(path),
    )
    await flushEffects()

    routeSet("whatsapp-otp")
    await flushEffects()
    expect(discoveryCount).toBe(1)
    expect(state.screen()).toBe("chooser")
    expect(navigated).toEqual(["/demo/login/chooser"])

    routeSet("chooser")
    await flushEffects()
    routeSet("whatsapp-otp")
    await flushEffects()
    expect(discoveryCount).toBe(2)
    expect(state.screen()).toBe("whatsapp-otp")
    expect(navigated).toEqual(["/demo/login/chooser"])
  })
})
