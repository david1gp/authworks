import { afterAll, beforeAll, expect, mock, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { unlink } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { Window } from "happy-dom"
import solid from "vite-plugin-solid"
import type { OrganizationMe } from "../../src/features/organizations/public/organizationMeSchema.js"

type AccountOrganizationAccessView =
  typeof import("../../src/features/account/ui/AccountOrganizationAccessView.js")["AccountOrganizationAccessView"]

const globalValues = globalThis as unknown as Record<string, unknown>
const globalNames = ["window", "document", "Node", "Element", "HTMLElement", "SVGElement", "Text"] as const
const previousGlobals = new Map<string, unknown>()
const compiledViewPath = join(import.meta.dirname, `.account-organization-access-view-${randomUUID()}.mjs`)
const cnRuntimePath = "../../node_modules/cn/dist/index.js"
const solidRuntimePath = "../../node_modules/solid-js/dist/dev.js"
const solidWebRuntimePath = "../../node_modules/solid-js/web/dist/web.js"

mock.module("solid-js", () => import(solidRuntimePath))
mock.module("solid-js/web", () => import(solidWebRuntimePath))
mock.module("cn", () => import(cnRuntimePath))

let accountOrganizationAccessView: AccountOrganizationAccessView
let createComponent: typeof import("solid-js").createComponent

beforeAll(async () => {
  const sourceRoot = resolve(import.meta.dirname, "../../")
  const plugin = solid()
  const transform = plugin.transform
  if (transform === undefined) throw new Error("Solid plugin did not expose a transform hook.")
  const transformHook = (typeof transform === "function" ? transform : transform.handler) as unknown as (
    code: string,
    id: string,
  ) => string | { readonly code: string }
  const sourceResolve = async (path: string) => {
    const candidates = [
      path,
      path.endsWith(".js") ? `${path.slice(0, -3)}.ts` : undefined,
      path.endsWith(".js") ? `${path.slice(0, -3)}.tsx` : undefined,
      path.endsWith(".jsx") ? `${path.slice(0, -4)}.tsx` : undefined,
      `${path}.ts`,
      `${path}.tsx`,
    ].filter((candidate): candidate is string => candidate !== undefined)
    for (const candidate of candidates) {
      if (await Bun.file(candidate).exists()) return candidate
    }
    return undefined
  }
  const build = await Bun.build({
    entrypoints: [resolve(sourceRoot, "src/features/account/ui/AccountOrganizationAccessView.tsx")],
    external: ["cn", "solid-js", "solid-js/web"],
    format: "esm",
    plugins: [
      {
        name: "account-organization-access-solid-test",
        setup(build) {
          build.onResolve({ filter: /^#ui\// }, async ({ path }) => {
            const resolved = await sourceResolve(resolve(sourceRoot, "ui", path.slice(4)))
            return resolved === undefined ? undefined : { path: resolved }
          })
          build.onResolve({ filter: /^\./ }, async ({ path, importer }) => {
            const resolved = await sourceResolve(resolve(importer ? dirname(importer) : sourceRoot, path))
            return resolved === undefined ? undefined : { path: resolved }
          })
          build.onLoad({ filter: /\.(?:ts|tsx|jsx)$/ }, async ({ path }) => {
            const source = await Bun.file(path).text()
            if (!path.endsWith(".tsx") && !path.endsWith(".jsx")) return { contents: source, loader: "ts" as const }
            const transformed = await transformHook.call({ environment: undefined }, source, path)
            const code = typeof transformed === "string" ? transformed : transformed?.code
            if (typeof code !== "string") throw new Error(`${path} did not compile for the runtime regression test.`)
            return { contents: new Bun.Transpiler({ loader: "ts" }).transformSync(code), loader: "js" as const }
          })
          build.onLoad({ filter: /\.module\.css$/ }, () => ({ contents: "export default {}", loader: "js" as const }))
        },
      },
    ],
  })
  if (!build.success) throw new Error("AccountOrganizationAccessView did not compile for the runtime regression test.")
  const output = build.outputs[0]
  if (output === undefined) throw new Error("AccountOrganizationAccessView produced no runtime test output.")
  await Bun.write(compiledViewPath, output)
  const solidRuntime = await import("solid-js")
  createComponent = solidRuntime.createComponent
})

afterAll(async () => {
  mock.restore()
  await unlink(compiledViewPath)
})

const organizationAccess = (id: string, name: string): OrganizationMe => ({
  membership: {
    createdAt: 1,
    id: `membership-${id}`,
    organizationId: id,
    realmId: "realm-1",
    roles: ["member"],
    updatedAt: 1,
    userId: "user-1",
  },
  organization: {
    createdAt: 1,
    id,
    name,
    realmId: "realm-1",
    status: "active",
    updatedAt: 1,
  },
})

const domSetup = () => {
  const browserWindow = new Window()
  const browserGlobals = {
    Element: browserWindow.Element,
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

const renderView = async (
  effectiveAccessStatus: "error" | "loading",
  effectiveAccessError?: string,
  organizationStatus: "error" | "loading" | "ready" = "ready",
) => {
  const browserWindow = domSetup()
  accountOrganizationAccessView ??= (await import(pathToFileURL(compiledViewPath).href)).AccountOrganizationAccessView
  const render = (await import("solid-js/web")).render
  const root = browserWindow.document.createElement("div")
  browserWindow.document.body.append(root)
  const organizations = [
    organizationAccess("alpha", "Alpha Organization"),
    organizationAccess("beta", "Beta Organization"),
  ]
  const props = {
    activeOrganizationId: "alpha",
    effectiveAccessError,
    effectiveAccessPending: false,
    effectiveAccessStatus,
    onEffectiveAccessLoadMore: () => {},
    onEffectiveAccessRetry: () => {},
    onOrganizationActivate: () => {},
    onOrganizationRetry: () => {},
    onOrganizationSelect: () => {},
    organizations,
    organizationStatus,
    pending: false,
    viewedOrganization: organizations[1],
    viewedOrganizationId: "beta",
  }
  const dispose = render(
    () => createComponent(accountOrganizationAccessView, props),
    root as unknown as Parameters<typeof render>[1],
  )
  await Promise.resolve()
  return { dispose, root }
}

test("keeps selected organization membership and activation visible while effective access loads", async () => {
  const { dispose, root } = await renderView("loading", undefined, "loading")

  const panel = root.querySelector('[role="tabpanel"]')
  expect(panel?.textContent).toContain("Beta Organization")
  expect(panel?.textContent).toContain("beta")
  expect(panel?.textContent).toContain("member")
  expect(panel?.textContent).toContain("Make active organization")
  expect(panel?.querySelector('[data-content-state="loading"]')).not.toBeNull()
  expect(root.querySelectorAll('[data-content-state="loading"]')).toHaveLength(1)
  expect(root.querySelector('[data-content-state="loading"]')).toBe(panel?.lastElementChild ?? null)
  expect(root.querySelector('[role="tablist"] [data-content-state]')).toBeNull()

  dispose()
  domRestore()
})

test("keeps selected organization membership and activation visible when effective access fails", async () => {
  const { dispose, root } = await renderView("error", "Effective access failed.", "error")

  const panel = root.querySelector('[role="tabpanel"]')
  expect(panel?.textContent).toContain("Beta Organization")
  expect(panel?.textContent).toContain("beta")
  expect(panel?.textContent).toContain("member")
  expect(panel?.textContent).toContain("Make active organization")
  expect(panel?.querySelector('[data-content-state="error"]')?.textContent).toContain("Effective access failed.")
  expect(panel?.querySelector('[data-content-state="error"] button')?.textContent).toContain("Try again")
  expect(root.querySelectorAll('[data-content-state="error"]')).toHaveLength(1)
  expect(root.querySelectorAll('[data-content-state="error"] button')).toHaveLength(1)
  expect(root.querySelector('[data-content-state="error"]')).toBe(panel?.lastElementChild ?? null)
  expect(root.querySelector('[role="tablist"] [data-content-state]')).toBeNull()

  dispose()
  domRestore()
})
