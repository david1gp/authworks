import { afterAll, beforeAll, expect, mock, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { unlink } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { Window } from "happy-dom"
import solid from "vite-plugin-solid"
import { createResult, createResultError } from "#result"
import type { AdminActivityAdapter } from "../../src/features/admin/ui/adminActivityAdapter.js"
import { adminDemoEventFixtures } from "../../src/features/admin/ui/adminDemoEventFixtures.js"

const compiledPath = join(import.meta.dirname, `.activity-${randomUUID()}.mjs`)
const solidRuntimePath = "../../node_modules/solid-js/dist/dev.js"
const solidWebRuntimePath = "../../node_modules/solid-js/web/dist/web.js"
mock.module("solid-js", () => import(solidRuntimePath))
mock.module("solid-js/web", () => import(solidWebRuntimePath))
let View: typeof import("../../src/features/admin/ui/AdminActivityView.js")["AdminActivityView"]

beforeAll(async () => {
  const root = resolve(import.meta.dirname, "../..")
  const transform = solid().transform!
  const hook = (typeof transform === "function" ? transform : transform.handler) as unknown as (
    code: string,
    path: string,
  ) => string | { code: string }
  const resolveSource = async (path: string) => {
    for (const candidate of [path, path.replace(/\.jsx?$/, ".ts"), path.replace(/\.jsx?$/, ".tsx")]) {
      if (await Bun.file(candidate).exists()) return candidate
    }
    return undefined
  }
  const build = await Bun.build({
    entrypoints: [resolve(root, "src/features/admin/ui/AdminActivityView.tsx")],
    external: ["solid-js", "solid-js/web"],
    format: "esm",
    plugins: [
      {
        name: "activity-view-solid",
        setup(build) {
          build.onResolve({ filter: /^#ui\// }, async ({ path }) => {
            const file = await resolveSource(resolve(root, "ui", path.slice(4)))
            return file ? { path: file } : undefined
          })
          build.onResolve({ filter: /^\./ }, async ({ path, importer }) => {
            const file = await resolveSource(resolve(dirname(importer), path))
            return file ? { path: file } : undefined
          })
          build.onLoad({ filter: /\.(ts|tsx|jsx)$/ }, async ({ path }) => {
            const source = await Bun.file(path).text()
            if (!/\.(tsx|jsx)$/.test(path)) return { contents: source, loader: "ts" }
            const transformed = await hook.call({ environment: undefined }, source, path)
            return {
              contents: new Bun.Transpiler({ loader: "ts" }).transformSync(
                typeof transformed === "string" ? transformed : transformed.code,
              ),
              loader: "js",
            }
          })
          build.onLoad({ filter: /\.module\.css$/ }, () => ({ contents: "export default {}", loader: "js" }))
        },
      },
    ],
  })
  if (!build.success || !build.outputs[0]) throw new Error("Activity view compilation failed")
  await Bun.write(compiledPath, build.outputs[0])
})

afterAll(async () => {
  mock.restore()
  await unlink(compiledPath)
})

test("Activity renders scope, readable records, safe disclosures and working cursor controls", async () => {
  const browser = new Window()
  const globals = globalThis as unknown as Record<string, unknown>
  const names = ["window", "document", "Node", "Element", "HTMLElement", "SVGElement", "Text"] as const
  const previous = new Map(names.map((name) => [name, globals[name]]))
  for (const name of names) globals[name] = name === "window" ? browser : browser[name]
  const cleanups: (() => void)[] = []
  try {
    View = (await import(pathToFileURL(compiledPath).href)).AdminActivityView
    const { createComponent } = await import("solid-js")
    const { render } = await import("solid-js/web")
    const calls: (string | undefined)[] = []
    const event = {
      ...adminDemoEventFixtures[0]!,
      eventType: "organization.updated",
      payload: { password: "hidden-password", name: "Northwind" },
    }
    const adapter: AdminActivityAdapter = {
      organizationList: async (_realm, _org, query) => {
        calls.push(query.pageToken)
        return createResult({ items: [event], nextPageToken: query.pageToken ? undefined : "next" })
      },
      realmList: async () => {
        throw new Error("Organization page must not request realm activity")
      },
    }
    const mount = (adapter: AdminActivityAdapter) => {
      const root = browser.document.createElement("div")
      browser.document.body.appendChild(root)
      cleanups.push(
        render(
          () =>
            createComponent(View, {
              adapter,
              realmId: () => "r",
              organizationId: () => "org",
              contextLabel: () => "Northwind Labs",
            }),
          root as unknown as HTMLElement,
        ),
      )
      return root
    }
    const flush = async () => {
      await Promise.resolve()
      await Promise.resolve()
    }
    const root = mount(adapter)
    expect(root.querySelector('[data-content-state="loading"]')).not.toBeNull()
    await flush()
    expect(root.querySelector("h1")?.textContent).toBe("Activity")
    expect(root.textContent).toContain("Organization · Northwind Labs")
    expect(root.querySelector("li h2")?.textContent).toBe("Organization updated")
    expect(root.querySelector("time")?.getAttribute("datetime")).toBe(new Date(event.occurredAt).toISOString())
    expect(root.querySelector("details summary")).not.toBeNull()
    expect(root.textContent).not.toContain("hidden-password")
    expect(root.querySelector("pre")?.textContent).toContain("Northwind")
    const button = (label: string) =>
      [...root.querySelectorAll("button")].find((button) => button.textContent?.trim() === label)!
    button("Next").click()
    await flush()
    expect(calls).toEqual([undefined, "next"])
    button("Previous").click()
    await flush()
    expect(calls).toEqual([undefined, "next", undefined])

    const empty = mount({ ...adapter, organizationList: async () => createResult({ items: [] }) })
    await flush()
    expect(empty.textContent).toContain("No recent administrative activity")
    let attempts = 0
    const error = mount({
      ...adapter,
      organizationList: async () => {
        attempts++
        return createResultError("activity", "private backend diagnostic")
      },
    })
    await flush()
    expect(error.querySelector('[data-content-state="error"]')).not.toBeNull()
    expect(error.textContent).not.toContain("private backend diagnostic")
    error.querySelector("button")?.click()
    await flush()
    expect(attempts).toBe(2)
    const denied = mount({
      ...adapter,
      organizationList: async () => ({ ...createResultError("activity", "denied"), statusCode: 403 }),
    })
    await flush()
    expect(denied.querySelector('[data-content-state="inaccessible"]')).not.toBeNull()
    expect(denied.querySelector("button")).toBeNull()
  } finally {
    for (const dispose of cleanups) dispose()
    for (const name of names) {
      const value = previous.get(name)
      if (value === undefined) delete globals[name]
      else globals[name] = value
    }
  }
})
