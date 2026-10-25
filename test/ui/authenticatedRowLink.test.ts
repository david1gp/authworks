import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { unlink } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { Window } from "happy-dom"
import solid from "vite-plugin-solid"

const globalValues = globalThis as unknown as Record<string, unknown>
const globalNames = [
  "window",
  "document",
  "Node",
  "Element",
  "HTMLElement",
  "HTMLHeadElement",
  "SVGElement",
  "Text",
] as const
const previousGlobals = new Map<string, unknown>()
const compiledTablePath = join(import.meta.dirname, `.authenticated-row-link-table-${randomUUID()}.mjs`)
const compiledTilePath = join(import.meta.dirname, `.authenticated-row-link-tile-${randomUUID()}.mjs`)
const solidRuntimePath = "../../node_modules/solid-js/dist/dev.js"
const solidWebRuntimePath = "../../node_modules/solid-js/web/dist/web.js"

mock.module("solid-js", () => import(solidRuntimePath))
mock.module("solid-js/web", () => import(solidWebRuntimePath))

let dataTable: typeof import("../../src/ui/authenticated/AuthenticatedDataTable.js")["AuthenticatedDataTable"]
let statTile: typeof import("../../src/ui/authenticated/AuthenticatedStatTile.js")["AuthenticatedStatTile"]
let memoryRouter: typeof import("@solidjs/router")["MemoryRouter"]
let routeComponent: typeof import("@solidjs/router")["Route"]
let createComponent: typeof import("solid-js").createComponent

const domSetup = () => {
  const browserWindow = new Window({ url: "https://example.com/demo/admin/users" })
  const browserGlobals = {
    Element: browserWindow.Element,
    HTMLHeadElement: browserWindow.HTMLHeadElement,
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

beforeAll(async () => {
  const initWindow = domSetup()
  try {
    await beforeAllCompile()
  } finally {
    void initWindow
    domRestore()
  }
})

const beforeAllCompile = async () => {
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
  const pluginFactory = (name: string) => ({
    name,
    setup(build: {
      onResolve: (
        filter: { readonly filter: RegExp },
        callback: (args: {
          readonly importer: string
          readonly path: string
        }) => Promise<{ readonly path: string } | undefined>,
      ) => void
      onLoad: (
        filter: { readonly filter: RegExp },
        callback: (args: {
          readonly path: string
        }) => Promise<{ readonly contents: string; readonly loader: "js" | "ts" }>,
      ) => void
    }) {
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
        if (typeof code !== "string") throw new Error(`${path} did not compile for the runtime test.`)
        return { contents: new Bun.Transpiler({ loader: "ts" }).transformSync(code), loader: "js" as const }
      })
      build.onLoad({ filter: /\.module\.css$/ }, async () => ({ contents: "export default {}", loader: "js" as const }))
    },
  })
  const tableBuild = await Bun.build({
    entrypoints: [resolve(sourceRoot, "src/ui/authenticated/AuthenticatedDataTable.tsx")],
    external: ["solid-js", "solid-js/web", "@solidjs/router"],
    format: "esm",
    plugins: [pluginFactory("authenticated-row-link-table")],
  })
  const tileBuild = await Bun.build({
    entrypoints: [resolve(sourceRoot, "src/ui/authenticated/AuthenticatedStatTile.tsx")],
    external: ["solid-js", "solid-js/web", "@solidjs/router"],
    format: "esm",
    plugins: [pluginFactory("authenticated-row-link-tile")],
  })
  if (!tableBuild.success || !tileBuild.success) throw new Error("Authenticated row-link fixtures did not compile.")
  const tableOutput = tableBuild.outputs[0]
  const tileOutput = tileBuild.outputs[0]
  if (tableOutput === undefined || tileOutput === undefined)
    throw new Error("Authenticated row-link fixtures produced no output.")
  await Bun.write(compiledTablePath, tableOutput)
  await Bun.write(compiledTilePath, tileOutput)
  ;({ AuthenticatedDataTable: dataTable } = (await import(pathToFileURL(compiledTablePath).href)) as {
    readonly AuthenticatedDataTable: typeof dataTable
  })
  ;({ AuthenticatedStatTile: statTile } = (await import(pathToFileURL(compiledTilePath).href)) as {
    readonly AuthenticatedStatTile: typeof statTile
  })
  ;({ MemoryRouter: memoryRouter, Route: routeComponent } = await import("@solidjs/router"))
  ;({ createComponent } = await import("solid-js"))
}

afterAll(async () => {
  mock.restore()
  await unlink(compiledTablePath)
  await unlink(compiledTilePath)
})

describe("authenticated row links", () => {
  test("data-table row links keep their full href instead of collapsing to true", async () => {
    const browserWindow = domSetup()
    const { render } = await import("solid-js/web")
    const root = browserWindow.document.createElement("div")
    browserWindow.document.body.append(root)
    const columns = [
      {
        cell: (row: { readonly name: string }) => row.name,
        header: "User",
        key: "user",
      },
    ]
    const tableView = () =>
      createComponent(dataTable, {
        caption: "People",
        columns,
        rowHref: (row: { readonly id: string }) => `/demo/admin/users/${row.id}`,
        rowKey: (row: { readonly id: string }) => row.id,
        rows: [{ id: "01900000-0000-7000-8000-000000000021", name: "Ada Osei" }],
      })
    const dispose = render(
      () =>
        createComponent(memoryRouter, {
          get children() {
            return createComponent(routeComponent, {
              component: tableView,
              path: "/",
            })
          },
        }),
      root as unknown as Parameters<typeof render>[1],
    )
    await Promise.resolve()
    const anchor = root.querySelector("tbody a")
    expect(anchor?.getAttribute("href")).toBe("/demo/admin/users/01900000-0000-7000-8000-000000000021")
    expect(anchor?.getAttribute("href")).not.toBe("true")
    dispose()
    domRestore()
  })

  test("stat tiles keep their full href instead of collapsing to true", async () => {
    const browserWindow = domSetup()
    const { render } = await import("solid-js/web")
    const root = browserWindow.document.createElement("div")
    browserWindow.document.body.append(root)
    const tileView = () =>
      createComponent(statTile, {
        href: "/admin/realm",
        label: "Realm",
        value: "Realm",
      })
    const dispose = render(
      () =>
        createComponent(memoryRouter, {
          get children() {
            return createComponent(routeComponent, {
              component: tileView,
              path: "/",
            })
          },
        }),
      root as unknown as Parameters<typeof render>[1],
    )
    await Promise.resolve()
    const anchor = root.querySelector("a")
    expect(anchor?.getAttribute("href")).toBe("/admin/realm")
    expect(anchor?.getAttribute("href")).not.toBe("true")
    dispose()
    domRestore()
  })
})
