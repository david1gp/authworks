import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { readFile, unlink } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { Window } from "happy-dom"
import type { JSX } from "solid-js"
import solid from "vite-plugin-solid"
import type { LoginScreen } from "../../src/features/login/model/loginScreenSchema.js"
import { loginDemoAdapterCreate } from "../../src/features/login/ui/loginDemoAdapterCreate.js"

type LoginPanelHeader = (props: {
  readonly description?: string
  readonly headingId?: string
  readonly headingRegister?: (element: HTMLHeadingElement) => void
  readonly headingTabIndex?: number
  readonly title: string
}) => JSX.Element
type PasswordResetStateCreate =
  typeof import("../../src/features/passwords/ui/passwordResetStateCreate.js")["passwordResetStateCreate"]
type LoginPageStateCreate = typeof import("../../src/features/login/ui/loginPageStateCreate.js")["loginPageStateCreate"]

const globalValues = globalThis as unknown as Record<string, unknown>
const globalNames = [
  "window",
  "document",
  "Node",
  "Element",
  "HTMLElement",
  "HTMLHeadElement",
  "HTMLHeadingElement",
  "SVGElement",
  "Text",
] as const
const previousGlobals = new Map<string, unknown>()
const compiledHeaderPath = join(import.meta.dirname, `.login-panel-header-${randomUUID()}.mjs`)
let loginPanelHeader: LoginPanelHeader
let passwordResetStateCreate: PasswordResetStateCreate
let loginPageStateCreate: LoginPageStateCreate
let createComponent: typeof import("solid-js").createComponent
let createSignal: typeof import("solid-js").createSignal
let show: (props: {
  readonly children: () => JSX.Element
  readonly fallback: () => JSX.Element
  readonly when: () => boolean
}) => JSX.Element

const solidRuntimePath = "../../node_modules/solid-js/dist/dev.js"
const solidWebRuntimePath = "../../node_modules/solid-js/web/dist/web.js"
mock.module("solid-js", () => import(solidRuntimePath))
mock.module("solid-js/web", () => import(solidWebRuntimePath))

beforeAll(async () => {
  const sourcePath = new URL("../../src/features/login/ui/LoginPanelHeader.tsx", import.meta.url)
  const source = await readFile(sourcePath, "utf8")
  const plugin = solid()
  const transform = plugin.transform
  if (transform === undefined) throw new Error("Solid plugin did not expose a transform hook.")
  const transformHook = (typeof transform === "function" ? transform : transform.handler) as unknown as (
    code: string,
    id: string,
  ) => string | { readonly code: string }
  const transformed = await transformHook.call({ environment: undefined }, source, sourcePath.pathname)
  const code = typeof transformed === "string" ? transformed : transformed?.code
  if (typeof code !== "string") throw new Error("LoginPanelHeader did not compile for the runtime regression test.")
  await Bun.write(compiledHeaderPath, new Bun.Transpiler({ loader: "ts" }).transformSync(code))
  const module = await import(pathToFileURL(compiledHeaderPath).href)
  loginPanelHeader = module.LoginPanelHeader as LoginPanelHeader
  passwordResetStateCreate = (await import("../../src/features/passwords/ui/passwordResetStateCreate.js"))
    .passwordResetStateCreate
  const solidRuntime = await import("solid-js")
  createComponent = solidRuntime.createComponent
  createSignal = solidRuntime.createSignal
  show = solidRuntime.Show as unknown as typeof show
  loginPageStateCreate = (await import("../../src/features/login/ui/loginPageStateCreate.js")).loginPageStateCreate
})

afterAll(async () => {
  mock.restore()
  await unlink(compiledHeaderPath)
})

const domSetup = () => {
  const browserWindow = new Window()
  const browserGlobals = {
    Element: browserWindow.Element,
    HTMLHeadElement: browserWindow.HTMLHeadElement,
    HTMLHeadingElement: browserWindow.HTMLHeadingElement,
    HTMLElement: browserWindow.HTMLElement,
    Node: browserWindow.Node,
    SVGElement: browserWindow.SVGElement,
    Text: browserWindow.Text,
    document: browserWindow.document,
    window: browserWindow,
  }
  for (const name of globalNames) {
    previousGlobals.set(name, globalValues[name])
    globalValues[name] = browserGlobals[name]
  }
  return browserWindow
}

const domRestore = () => {
  for (const name of globalNames) {
    const previous = previousGlobals.get(name)
    if (previous === undefined) delete globalValues[name]
    else globalValues[name] = previous
  }
  previousGlobals.clear()
}

describe("LoginPanelHeader client runtime", () => {
  test("lets a pending recovery request resolve to the sent route", async () => {
    const browserWindow = domSetup()
    const { render } = await import("solid-js/web")
    const root = browserWindow.document.createElement("div")
    const renderRoot = root as unknown as Parameters<typeof render>[1]
    browserWindow.document.body.append(root)
    const [route, routeSet] = createSignal<LoginScreen>("recovery-request")
    let page: ReturnType<typeof loginPageStateCreate> | undefined
    const recoveryPath = () => {
      page = loginPageStateCreate({
        adapter: loginDemoAdapterCreate({ fixtureState: () => "success", onResume: () => {} }),
        basePath: "/demo/login",
        initialStatus: () => "ready",
        navigate: (path) => {
          if (path.endsWith("/password/forgot/sent")) routeSet("recovery-sent")
        },
        screen: route,
      })
      return createComponent(show, {
        children: () => createComponent(loginPanelHeader, { title: "Recovery email sent" }),
        fallback: () => createComponent(loginPanelHeader, { title: "Enter your email" }),
        when: () => route() === "recovery-sent",
      })
    }

    let dispose: (() => void) | undefined
    expect(() => {
      dispose = render(() => createComponent(recoveryPath, {}), renderRoot)
    }).not.toThrow()

    if (page === undefined) throw new Error("The recovery page state was not created.")
    page.email.set("alex@example.com")
    const request = page.recoverySubmit({ preventDefault: () => {} } as SubmitEvent)
    expect(page.pending()).toBe(true)
    await request
    expect(route()).toBe("recovery-sent")
    await Promise.resolve()
    const heading = root.querySelector("h1")
    expect(heading?.textContent).toBe("Recovery email sent")
    expect(heading?.getAttribute("tabindex")).toBe("-1")
    dispose?.()
    domRestore()
  })

  test("registers the recovery heading so navigation focus remains automatic", async () => {
    const browserWindow = domSetup()
    const { render } = await import("solid-js/web")
    const root = browserWindow.document.createElement("div")
    const renderRoot = root as unknown as Parameters<typeof render>[1]
    browserWindow.document.body.append(root)
    let registered: HTMLHeadingElement | undefined

    const resetCompletePath = () => {
      const state = passwordResetStateCreate({
        confirmPassword: () => "",
        newPassword: () => "",
        onConfirmPassword: () => {},
        onNewPassword: () => {},
        onSubmit: () => {},
        pending: () => false,
        step: () => "complete" as const,
        validationMessage: () => undefined,
      })
      return createComponent(loginPanelHeader, {
        headingRegister: (element) => {
          registered = element
          state.headingRegister(element)
        },
        title: "Choose a new password",
      })
    }

    const dispose = render(() => createComponent(resetCompletePath, {}), renderRoot)

    await Promise.resolve()
    const heading = root.querySelector("h1") as unknown as HTMLHeadingElement | undefined
    expect(registered as unknown).toBe(heading as unknown)
    if (registered === undefined) throw new Error("The recovery heading was not registered.")
    expect(browserWindow.document.activeElement as unknown).toBe(registered as unknown)
    dispose()
    domRestore()
  })
})
