import { afterAll, beforeAll, expect, mock, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { unlink } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { Window } from "happy-dom"
import solid from "vite-plugin-solid"

type AccountInvitationView =
  typeof import("../../src/features/account/ui/AccountInvitationView.js")["AccountInvitationView"]

const globalValues = globalThis as unknown as Record<string, unknown>
const globalNames = ["window", "document", "Node", "Element", "HTMLElement", "SVGElement", "Text"] as const
const previousGlobals = new Map<string, unknown>()
const compiledViewPath = join(import.meta.dirname, `.account-invitation-view-${randomUUID()}.mjs`)
const solidRuntimePath = "../../node_modules/solid-js/dist/dev.js"
const solidWebRuntimePath = "../../node_modules/solid-js/web/dist/web.js"

mock.module("solid-js", () => import(solidRuntimePath))
mock.module("solid-js/web", () => import(solidWebRuntimePath))

let accountInvitationView: AccountInvitationView
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
    entrypoints: [resolve(sourceRoot, "src/features/account/ui/AccountInvitationView.tsx")],
    external: ["solid-js", "solid-js/web"],
    format: "esm",
    plugins: [
      {
        name: "account-invitation-solid-test",
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
  if (!build.success) throw new Error("AccountInvitationView did not compile for the runtime regression test.")
  const output = build.outputs[0]
  if (output === undefined) throw new Error("AccountInvitationView produced no runtime test output.")
  await Bun.write(compiledViewPath, output)
  const solidRuntime = await import("solid-js")
  createComponent = solidRuntime.createComponent
})

afterAll(async () => {
  mock.restore()
  await unlink(compiledViewPath)
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

test("renders the invited organization name and falls back to its ID for older responses", async () => {
  const browserWindow = domSetup()
  accountInvitationView ??= (await import(pathToFileURL(compiledViewPath).href)).AccountInvitationView
  const render = (await import("solid-js/web")).render
  const root = browserWindow.document.createElement("div")
  browserWindow.document.body.append(root)
  const invitation = {
    acceptedAt: null,
    createdAt: 1,
    email: "user@example.com",
    expiresAt: 100000,
    id: "invite-1",
    organizationId: "organization-id",
    organizationName: "Northwind Labs",
    realmId: "realm-1",
    roles: ["member" as const],
    status: "pending" as const,
    updatedAt: 1,
  }
  const props = { invitation, onAccept: () => {}, onDecline: () => {}, onRetry: () => {}, status: "ready" as const }
  const dispose = render(
    () => createComponent(accountInvitationView, props),
    root as unknown as Parameters<typeof render>[1],
  )
  expect(root.textContent).toContain("Northwind Labs")
  expect(root.textContent).not.toContain("organization-id")
  dispose()
  const { organizationName: _, ...legacyInvitation } = invitation
  const disposeLegacy = render(
    () => createComponent(accountInvitationView, { ...props, invitation: legacyInvitation }),
    root as unknown as Parameters<typeof render>[1],
  )
  expect(root.textContent).toContain("organization-id")
  disposeLegacy()
  domRestore()
})
