import { expect, test } from "bun:test"
import { mkdtemp, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { serverApplicationCreate } from "../../src/compositions/serverApplicationCreate.js"

type FileSnapshot = {
  readonly exists: boolean
  readonly mtimeMs?: number
}

test("importing the server output does not initialize SQLite", async () => {
  const databasePath = join(process.cwd(), "authworks.sqlite")
  const before = await fileSnapshot(databasePath)
  await import("../../src/outputs/server.js")
  const after = await fileSnapshot(databasePath)

  expect(after.exists).toBe(before.exists)
  if (before.exists) expect(after.mtimeMs).toBe(before.mtimeMs)
})

test("server application creation returns a Result error for a bad database path", async () => {
  const parent = await mkdtemp(join(tmpdir(), "authworks-invalid-db-"))
  await rm(parent, { force: true, recursive: true })

  const result = serverApplicationCreate({ databasePath: join(parent, "missing", "authworks.sqlite") })

  expect(result.success).toBe(false)
})

async function fileSnapshot(filePath: string): Promise<FileSnapshot> {
  try {
    const information = await stat(filePath)
    return { exists: true, mtimeMs: information.mtimeMs }
  } catch (_error) {
    return { exists: false }
  }
}
