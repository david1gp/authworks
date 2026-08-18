import { expect, test } from "bun:test"
import * as v from "valibot"
import { readdir } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { join } from "node:path"

test("every public list response uses the items envelope", async () => {
  const featureRoot = join(process.cwd(), "src/features")
  const featureEntries = await readdir(featureRoot, { withFileTypes: true })
  const schemaFiles = (
    await Promise.all(
      featureEntries
        .filter((entry) => entry.isDirectory())
        .map((entry) => filesWalk(join(featureRoot, entry.name, "public"))),
    )
  )
    .flat()
    .filter((filePath) => filePath.endsWith("ListResponseSchema.ts"))

  for (const filePath of schemaFiles) {
    const module = (await import(pathToFileURL(filePath).href)) as Record<string, unknown>
    const exportName = filePath.slice(filePath.lastIndexOf("/") + 1, -3)
    const schema = module[exportName]
    expect(schema, filePath).toBeDefined()
    if (schema === undefined) continue

    expect(v.safeParse(schema as v.GenericSchema, { items: [] }).success, filePath).toBe(true)
    expect(v.safeParse(schema as v.GenericSchema, { users: [] }).success, filePath).toBe(false)
  }
})

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
