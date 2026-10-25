import { afterEach, expect, test } from "bun:test"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { mkdir, utimes, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { e2eCleanupStaleStateRemove } from "../../e2e/harness/e2eCleanupStaleStateRemove.js"

const directories: string[] = []

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true })
})

const staleDate = new Date("2026-10-20T00:00:00.000Z")
const now = new Date("2026-10-26T00:00:00.000Z")

async function staleStateDirCreate(): Promise<string> {
  const directory = mkdtempSync(join(tmpdir(), "authworks-e2e-stale-state-"))
  directories.push(directory)
  for (const target of ["dev", "production"] as const) {
    await mkdir(join(directory, target, "artifacts"), { recursive: true })
    await writeFile(join(directory, target, "checkpoint.json"), "{}")
    await writeFile(join(directory, target, "env.json"), "{}")
    await writeFile(join(directory, target, "artifacts", "old-trace.zip"), "trace")
    for (const entry of ["checkpoint.json", "env.json", join("artifacts", "old-trace.zip")])
      await utimes(join(directory, target, entry), staleDate, staleDate)
  }
  return directory
}

test("stale state removal deletes old files but keeps checkpoints and fresh files", async () => {
  const directory = await staleStateDirCreate()
  await writeFile(join(directory, "dev", "server.log"), "fresh")
  await writeFile(join(directory, "production", "server.log"), "fresh")

  e2eCleanupStaleStateRemove(directory, now)

  expect(existsSync(join(directory, "dev", "env.json"))).toBe(false)
  expect(existsSync(join(directory, "production", "env.json"))).toBe(false)
  expect(existsSync(join(directory, "dev", "artifacts", "old-trace.zip"))).toBe(false)
  expect(existsSync(join(directory, "dev", "checkpoint.json"))).toBe(true)
  expect(existsSync(join(directory, "dev", "server.log"))).toBe(true)
  expect(existsSync(join(directory, "production", "server.log"))).toBe(true)
})

test("stale state removal keeps the dev directory while the dev server is alive", async () => {
  const directory = await staleStateDirCreate()

  e2eCleanupStaleStateRemove(directory, now, { devServerRunning: true })

  expect(existsSync(join(directory, "dev", "env.json"))).toBe(true)
  expect(existsSync(join(directory, "dev", "artifacts", "old-trace.zip"))).toBe(true)
  expect(existsSync(join(directory, "dev", "checkpoint.json"))).toBe(true)
  expect(existsSync(join(directory, "production", "env.json"))).toBe(false)
})
