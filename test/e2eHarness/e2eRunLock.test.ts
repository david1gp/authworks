import { expect, test } from "bun:test"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { e2eRunLockAcquire, e2eRunLockRelease } from "../../e2e/harness/e2eRunLockAcquire.js"

test("e2e run lock grants the first run and refuses a concurrent second run", () => {
  const directory = e2eRunLockTestDirCreate()
  const lockPath = `${directory}/dev/run.lock`
  const first = e2eRunLockAcquire(lockPath)
  expect(first.success).toBe(true)
  if (!first.success) return
  expect(first.data.pid).toBe(process.pid)
  expect(existsSync(lockPath)).toBe(true)
  const second = e2eRunLockAcquire(lockPath)
  expect(second.success).toBe(false)
  if (!second.success) expect(second.errorMessage).toContain("already in progress")
  const beforeRelease = e2eRunLockAcquire(lockPath)
  expect(beforeRelease.success).toBe(false)
  e2eRunLockRelease(lockPath)
  expect(existsSync(lockPath)).toBe(false)
  const afterRelease = e2eRunLockAcquire(lockPath)
  expect(afterRelease.success).toBe(true)
  e2eRunLockRelease(lockPath)
})

test("e2e run lock reclaims a lock whose owner process is dead", () => {
  const directory = e2eRunLockTestDirCreate()
  const lockPath = `${directory}/dev/run.lock`
  mkdirSync(`${directory}/dev`, { recursive: true })
  writeFileSync(lockPath, `${JSON.stringify({ pid: 2 ** 31 - 1, startedAt: "2026-01-01T00:00:00.000Z" })}\n`)
  const acquired = e2eRunLockAcquire(lockPath)
  expect(acquired.success).toBe(true)
  if (!acquired.success) return
  expect(acquired.data.pid).toBe(process.pid)
  e2eRunLockRelease(lockPath)
})

test("e2e run lock replaces corrupt lock content instead of blocking forever", () => {
  const directory = e2eRunLockTestDirCreate()
  const lockPath = `${directory}/dev/run.lock`
  mkdirSync(`${directory}/dev`, { recursive: true })
  writeFileSync(lockPath, "not-json{{{")
  const acquired = e2eRunLockAcquire(lockPath)
  expect(acquired.success).toBe(true)
  e2eRunLockRelease(lockPath)
})

test("e2e run lock release keeps a lock owned by another live process", () => {
  const directory = e2eRunLockTestDirCreate()
  const lockPath = `${directory}/production/run.lock`
  mkdirSync(`${directory}/production`, { recursive: true })
  const foreign = `${JSON.stringify({ pid: process.pid + 1, startedAt: new Date().toISOString() })}\n`
  writeFileSync(lockPath, foreign)
  e2eRunLockRelease(lockPath)
  expect(readFileSync(lockPath, "utf8")).toBe(foreign)
})

test("e2e run lock requires a path", () => {
  expect(e2eRunLockAcquire("").success).toBe(false)
  expect(() => e2eRunLockRelease("")).not.toThrow()
})

function e2eRunLockTestDirCreate(): string {
  const directory = `${process.env.TMPDIR ?? "/tmp"}/authworks-e2e-runlock-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  mkdirSync(directory, { recursive: true })
  return directory
}
