import { afterAll, expect, mock, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { unlink } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { Window } from "happy-dom"
import solid from "vite-plugin-solid"

const solidRuntimePath = "../../node_modules/solid-js/dist/dev.js"
const solidWebRuntimePath = "../../node_modules/solid-js/web/dist/web.js"
mock.module("solid-js", () => import(solidRuntimePath))
mock.module("solid-js/web", () => import(solidWebRuntimePath))
mock.module("#ui/static/icon/Icon.jsx", () => ({ Icon: () => document.createElement("svg") }))

const runId = randomUUID()
const workdir = new URL("../../src/ui/i18n/ui/", import.meta.url).pathname
const selectorPath = join(workdir, `.language-runtime-${runId}.mjs`)
const probePath = join(workdir, `.language-probe-${runId}.mjs`)
const probeSourcePath = join(workdir, `.language-probe-${runId}.tsx`)

afterAll(async () => {
  mock.restore()
  await Promise.all([selectorPath, probePath, probeSourcePath].map((path) => unlink(path).catch(() => undefined)))
})

async function compileSource(pathname: string, outPath: string): Promise<void> {
  const sourcePath = new URL(pathname, import.meta.url)
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
  await Bun.write(outPath, new Bun.Transpiler({ loader: "ts" }).transformSync(code))
}

test("the language selector applies the chosen catalog and restores the previous one on failure", async () => {
  await compileSource("../../src/ui/i18n/ui/LanguageSelector.tsx", selectorPath)
  const selectorName = selectorPath.split("/").at(-1)
  await Bun.write(
    probeSourcePath,
    `import { LanguageSelector } from "./${selectorName}";\nimport { messageTranslate } from "../model/messageTranslate.js";\n\nexport function LanguageProbe() {\n  return (\n    <div>\n      <LanguageSelector />\n      <p data-testid="language-probe">{messageTranslate("common.language")}</p>\n    </div>\n  )\n}\n`,
  )
  await compileSource(`../../src/ui/i18n/ui/${probeSourcePath.split("/").at(-1)}`, probePath)

  const deCsv = await Bun.file(new URL("../../public/i18n/de.csv", import.meta.url)).text()

  const browser = new Window()
  const serverFetch = async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith("/i18n/de.csv")) return new Response(deCsv, { headers: { "content-type": "text/csv" } })
    throw new Error(`unexpected catalog request: ${url}`)
  }
  browser.fetch = serverFetch as typeof fetch

  const globals = globalThis as unknown as Record<string, unknown>
  const names = ["window", "document", "Node", "Element", "HTMLElement", "SVGElement", "Text"] as const
  const previous = new Map(names.map((name) => [name, globals[name]]))
  for (const name of names) globals[name] = name === "window" ? browser : browser[name]
  try {
    const { LanguageProbe } = await import(pathToFileURL(probePath).href)
    const { i18nStore } = await import("../../src/ui/i18n/model/i18nStore.js")
    const { createComponent } = await import("solid-js")
    const { render } = await import("solid-js/web")
    i18nStore.language.set("en")
    i18nStore.dictionary.set({})

    const root = browser.document.createElement("div")
    const dispose = render(() => createComponent(LanguageProbe, {}), root as unknown as HTMLElement)
    try {
      const select = root.querySelector("select")
      const probe = root.querySelector('[data-testid="language-probe"]')
      expect(select).not.toBeNull()
      expect(select?.value).toBe("en")
      expect(probe?.textContent).toBe("Language")

      select!.value = "de"
      select!.dispatchEvent(new browser.Event("change", { bubbles: true }))
      for (let attempt = 0; attempt < 100 && probe?.textContent === "Language"; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
      expect(i18nStore.language.get()).toBe("de")
      expect(select?.value).toBe("de")
      expect(probe?.textContent).toBe("Sprache")
      expect(browser.document.documentElement.lang).toBe("de")
      expect(browser.localStorage.getItem("authworks:language:v1")).toBe("de")

      browser.fetch = (async () => {
        throw new Error("catalog unavailable")
      }) as typeof fetch
      select!.value = "fr"
      select!.dispatchEvent(new browser.Event("change", { bubbles: true }))
      for (let attempt = 0; attempt < 100 && i18nStore.language.get() === "de"; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(i18nStore.language.get()).toBe("de")
      expect(select?.value).toBe("de")
      expect(probe?.textContent).toBe("Sprache")
    } finally {
      dispose()
      i18nStore.language.set("en")
      i18nStore.dictionary.set({})
    }
  } finally {
    for (const name of names) {
      const value = previous.get(name)
      if (value === undefined) delete globals[name]
      else globals[name] = value
    }
  }
})
