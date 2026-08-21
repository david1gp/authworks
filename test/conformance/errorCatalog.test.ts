import { expect, test } from "bun:test"
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import * as v from "valibot"
import { errorCatalog } from "../../src/platform/errors/errorCatalog.js"
import { resultErrorCodeSchema } from "../../src/platform/errors/resultErrorCodeSchema.js"

type CatalogEntry = (typeof errorCatalog)[number]
type CatalogModule = Record<string, unknown>

const codedErrorPattern = /(?:resultErrorCodedCreate|resultErrorCreate)\([^)]*?["']([a-z][a-z0-9-]*\.[a-z0-9-]+)["']/gs

test("the composed error catalog is valid, unique, and complete", async () => {
  const catalogCodes = new Set(errorCatalog.map((entry) => entry.code))
  expect(catalogCodes.size).toBe(errorCatalog.length)

  for (const entry of errorCatalog) {
    expect(v.safeParse(resultErrorCodeSchema, entry.code).success).toBe(true)
  }

  const catalogFiles = await errorCatalogFiles()
  for (const filePath of catalogFiles) {
    const module = (await import(pathToFileURL(filePath).href)) as CatalogModule
    const catalog = catalogModuleGet(module)
    expect(catalog, filePath).toBeDefined()
    if (catalog === undefined) continue
    for (const entry of catalog) expect(catalogCodes.has(entry.code), `${filePath}: ${entry.code}`).toBe(true)
  }

  const sourceFiles = (await filesWalk(join(process.cwd(), "src"))).filter(
    (filePath) => filePath.endsWith(".ts") && !filePath.includes("/test/"),
  )
  const missingCodes = new Set<string>()
  for (const filePath of sourceFiles) {
    const source = await readFile(filePath, "utf8")
    for (const match of source.matchAll(codedErrorPattern)) {
      const code = match[1]
      if (code !== undefined && !catalogCodes.has(code)) missingCodes.add(code)
    }
  }
  expect([...missingCodes]).toEqual([])
})

async function errorCatalogFiles(): Promise<string[]> {
  const featureRoot = join(process.cwd(), "src/features")
  const featureEntries = await readdir(featureRoot, { withFileTypes: true })
  const files = (
    await Promise.all(
      featureEntries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const directory = join(featureRoot, entry.name, "errors")
          try {
            return await filesWalk(directory)
          } catch (_error) {
            return []
          }
        }),
    )
  ).flat()
  files.push(join(process.cwd(), "src/platform/errors/platformErrorCatalog.ts"))
  return files.filter((filePath) => filePath.endsWith("ErrorCatalog.ts"))
}

function catalogModuleGet(module: CatalogModule): readonly CatalogEntry[] | undefined {
  for (const value of Object.values(module)) {
    if (!Array.isArray(value)) continue
    if (value.every((entry) => isCatalogEntry(entry))) return value
  }
  return undefined
}

function isCatalogEntry(value: unknown): value is CatalogEntry {
  return typeof value === "object" && value !== null && "code" in value && typeof value.code === "string"
}

async function filesWalk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const filePath = join(directory, entry.name)
      if (entry.isDirectory()) return filesWalk(filePath)
      return [filePath]
    }),
  )
  return nested.flat()
}
