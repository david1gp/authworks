import { afterAll, expect, mock, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { unlink } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { Window } from "happy-dom"
import solid from "vite-plugin-solid"

const compiledPath = join(import.meta.dirname, `.authenticated-tabs-${randomUUID()}.mjs`)
const solidRuntimePath = "../../node_modules/solid-js/dist/dev.js"
const solidWebRuntimePath = "../../node_modules/solid-js/web/dist/web.js"
mock.module("solid-js", () => import(solidRuntimePath))
mock.module("solid-js/web", () => import(solidWebRuntimePath))
mock.module("#ui/static/icon/Icon.jsx", () => ({ Icon: () => document.createElement("svg") }))
mock.module("#ui/utils/classMerge.js", () => ({
  classMerge: (...values: unknown[]) => values.filter(Boolean).join(" "),
}))

afterAll(async () => {
  mock.restore()
  await unlink(compiledPath)
})

test("section navigation exposes ordinary links and identifies the current page", async () => {
  const sourcePath = new URL("../../src/ui/authenticated/AuthenticatedTabs.tsx", import.meta.url)
  const transform = solid().transform
  if (transform === undefined) throw new Error("Solid plugin did not expose a transform hook.")
  const hook = (typeof transform === "function" ? transform : transform.handler) as unknown as (
    code: string,
    id: string,
  ) => string | { readonly code: string }
  const transformed = await hook.call(
    { environment: undefined },
    await Bun.file(sourcePath).text(),
    sourcePath.pathname,
  )
  const code = typeof transformed === "string" ? transformed : transformed.code
  await Bun.write(compiledPath, new Bun.Transpiler({ loader: "ts" }).transformSync(code))

  const browser = new Window()
  const globals = globalThis as unknown as Record<string, unknown>
  const names = ["window", "document", "Node", "Element", "HTMLElement", "SVGElement", "Text"] as const
  const previous = new Map(names.map((name) => [name, globals[name]]))
  for (const name of names) globals[name] = name === "window" ? browser : browser[name]
  try {
    const { AuthenticatedTabs } = await import(pathToFileURL(compiledPath).href)
    const { createComponent } = await import("solid-js")
    const { render } = await import("solid-js/web")
    const root = browser.document.createElement("div")
    const dispose = render(
      () =>
        createComponent(AuthenticatedTabs, {
          active: "overview",
          items: [
            { value: "overview", label: "Overview", href: "/overview" },
            { value: "roles", label: "Roles", href: "/roles" },
          ],
          label: "Project sections",
        }),
      root as unknown as HTMLElement,
    )
    const nav = root.querySelector('nav[aria-label="Project sections"]')
    expect(nav).not.toBeNull()
    const links = nav?.querySelectorAll("a[href]")
    expect(links).toHaveLength(2)
    expect(links?.[0]?.getAttribute("href")).toBe("/overview")
    expect(links?.[0]?.getAttribute("aria-current")).toBe("page")
    expect(links?.[1]?.getAttribute("href")).toBe("/roles")
    expect(links?.[1]?.hasAttribute("aria-current")).toBe(false)
    expect(nav?.querySelector('[role="tablist"], [role="tab"], [aria-selected]')).toBeNull()
    dispose()
  } finally {
    for (const name of names) {
      const value = previous.get(name)
      if (value === undefined) delete globals[name]
      else globals[name] = value
    }
  }
})
