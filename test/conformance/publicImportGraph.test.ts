import { expect, test } from "bun:test"
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

const forbiddenSegments = ["/domain/", "/actions/", "/persistence/", "/events/", "/server/", "/client/"]
const importPathPattern = /(?:from\s+|import\s*(?:\(\s*)?)["']([^"']+)["']/g

test("feature public contracts have a closed import graph", async () => {
  const featureRoot = join(process.cwd(), "src/features")
  const featureEntries = await readdir(featureRoot, { withFileTypes: true })
  const publicFiles = (
    await Promise.all(
      featureEntries
        .filter((entry) => entry.isDirectory())
        .map((entry) => filesWalk(join(featureRoot, entry.name, "public"))),
    )
  )
    .flat()
    .filter((filePath) => filePath.endsWith(".ts"))

  const violations: string[] = []
  for (const filePath of publicFiles) {
    const source = await readFile(filePath, "utf8")
    for (const match of source.matchAll(importPathPattern)) {
      const importedPath = match[1]
      if (importedPath !== undefined && forbiddenSegments.some((segment) => importedPath.includes(segment))) {
        violations.push(`${filePath}: ${importedPath}`)
      }
    }
  }

  expect(violations).toEqual([])
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
