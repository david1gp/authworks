import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from "bun:test"
import { Window } from "happy-dom"
import type { DemoFixtureState } from "../../demo/demoFixtureStateSchema.js"
import { demoLoginBootstrap } from "../../demo/demoLoginBootstrap.js"
import type { LoginScreen } from "../model/loginScreenSchema.js"
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
      adapter: loginDemoAdapterCreate({ fixtureState: () => fixtureState, onResume }),
      basePath: "/demo/login",
      initialDiscovery: initialStatus === "loading" ? undefined : () => demoLoginBootstrap,
      initialStatus: initialStatus === undefined ? () => "ready" : () => initialStatus,
      navigate: () => {},
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
})
