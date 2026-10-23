import { expect, test } from "bun:test"
import * as v from "valibot"
import { e2eCheckpointActivePathGet } from "../../e2e/harness/e2eCheckpointActivePathGet.js"
import { e2eCheckpointClear } from "../../e2e/harness/e2eCheckpointClear.js"
import { e2eCheckpointIsStale } from "../../e2e/harness/e2eCheckpointIsStale.js"
import { e2eCheckpointPathGet } from "../../e2e/harness/e2eCheckpointPathGet.js"
import { e2eCheckpointRead } from "../../e2e/harness/e2eCheckpointRead.js"
import { e2eCheckpointSchema } from "../../e2e/harness/e2eCheckpointSchema.js"
import { e2eCheckpointWrite } from "../../e2e/harness/e2eCheckpointWrite.js"
import { e2eEntityRecord } from "../../e2e/harness/e2eEntityRecord.js"
import { e2eRunIdCreate } from "../../e2e/harness/e2eRunIdCreate.js"
import { e2eStateDirResolve } from "../../e2e/harness/e2eStateDirResolve.js"
import { e2eStepRun } from "../../e2e/harness/e2eStepRun.js"
import { e2eTargetResolve } from "../../e2e/harness/e2eTargetResolve.js"
import { e2eTargetSchema } from "../../e2e/harness/e2eTargetSchema.js"
import { e2eTestEmailCreate } from "../../e2e/harness/e2eTestEmailCreate.js"
import { e2eTestNameCreate } from "../../e2e/harness/e2eTestNameCreate.js"
import { e2eTestNameCreatedAtParse } from "../../e2e/harness/e2eTestNameCreatedAtParse.js"
import { e2eTestNamePattern } from "../../e2e/harness/e2eTestNamePattern.js"

test("e2e run IDs use a UTC timestamp with a lowercase base36 suffix", () => {
  const runId = e2eRunIdCreate(new Date("2026-03-04T05:06:00.000Z"), () => 0)
  expect(runId).toBe("202603040506-000000")
  expect(e2eTestNamePattern.test(`e2e-aw-${runId}-owner`)).toBe(true)
})

test("e2e test names sanitise the suffix to lowercase alphanumerics and dashes", () => {
  const name = e2eTestNameCreate("202603040506-abcdef", "Org Owner Setup!")
  expect(name).toBe("e2e-aw-202603040506-abcdef-org-owner-setup")
})

test("e2e test name timestamps parse back to the run date", () => {
  const parsed = e2eTestNameCreatedAtParse("e2e-aw-202603040506-abcdef-owner")
  expect(parsed.success).toBe(true)
  if (parsed.success) expect(parsed.data.toISOString()).toBe("2026-03-04T05:06:00.000Z")
  expect(e2eTestNameCreatedAtParse("not-an-e2e-name").success).toBe(false)
})

test("e2e test name pattern exposes the timestamp and random groups", () => {
  const match = e2eTestNamePattern.exec("e2e-aw-202603040506-abc123-owner")
  expect(match?.[1]).toBe("202603040506")
  expect(match?.[2]).toBe("abc123")
  expect(e2eTestNamePattern.test("e2e-aw-2026030405-abc123-owner")).toBe(false)
})

test("e2e test emails derive from the test name", () => {
  expect(e2eTestEmailCreate("e2e-aw-202603040506-abcdef-owner")).toBe("e2e-aw-202603040506-abcdef-owner@example.com")
})

test("e2e targets resolve production by default and dev from the environment", () => {
  expect(e2eTargetResolve({}).success).toBe(true)
  const production = e2eTargetResolve({})
  if (production.success) {
    expect(production.data.target).toBe("production")
    expect(production.data.baseUrl).toBe("https://authworks.contentoren.de")
  }
  expect(e2eTargetResolve({ AUTHWORKS_E2E_TARGET: "staging" }).success).toBe(false)
  const dev = e2eTargetResolve({ AUTHWORKS_E2E_TARGET: "dev" })
  if (dev.success) {
    expect(dev.data.target).toBe("dev")
    expect(dev.data.baseUrl).toBe("http://127.0.0.1:5190")
  }
  const devCustom = e2eTargetResolve({ AUTHWORKS_E2E_BASE_URL: "http://127.0.0.1:6001", AUTHWORKS_E2E_TARGET: "dev" })
  if (devCustom.success) expect(devCustom.data.baseUrl).toBe("http://127.0.0.1:6001")
  expect(v.safeParse(e2eTargetSchema, "production").success).toBe(true)
})

test("e2e state dir prefers an override, then the shared dir, then a user fallback", () => {
  const override = e2eStateDirResolve({ AUTHWORKS_E2E_STATE_DIR: "/tmp/custom-e2e-state" })
  expect(override.success).toBe(true)
  if (override.success) expect(override.data).toBe("/tmp/custom-e2e-state")
})

test("e2e checkpoint paths nest under the state dir per target", () => {
  expect(e2eCheckpointPathGet("/tmp/state", "dev")).toBe("/tmp/state/dev/checkpoint.json")
  expect(e2eCheckpointActivePathGet({})).toBe(undefined)
  expect(e2eCheckpointActivePathGet({ AUTHWORKS_E2E_CHECKPOINT_PATH: "/tmp/state/dev/checkpoint.json" })).toBe(
    "/tmp/state/dev/checkpoint.json",
  )
})

test("e2e checkpoints round-trip through atomic writes and validate on read", async () => {
  const directory = await e2eTestTemporaryDirCreate()
  const path = e2eCheckpointPathGet(directory, "dev")
  const checkpoint = {
    baseUrl: "http://127.0.0.1:5190",
    completedSteps: ["setup"],
    completedSuites: ["adminOrgOwner"],
    entities: [
      { createdAt: "2026-03-04T05:06:00.000Z", id: "user-1", kind: "user" as const, name: "e2e-aw-run-owner" },
    ],
    runId: "202603040506-abcdef",
    startedAt: "2026-03-04T05:06:00.000Z",
    target: "dev" as const,
    values: { ownerId: "user-1" },
    version: 1 as const,
  }
  const written = e2eCheckpointWrite(path, checkpoint)
  expect(written.success).toBe(true)
  const read = e2eCheckpointRead(path)
  expect(read.success).toBe(true)
  if (read.success && "checkpoint" in read.data) expect(read.data.checkpoint).toEqual(checkpoint)
  const stored = Bun.file(path)
  expect((await stored.stat()).mode.toString(8).slice(-3)).toBe("600")
  const cleared = e2eCheckpointClear(path)
  expect(cleared.success).toBe(true)
  const missing = e2eCheckpointRead(path)
  expect(missing.success).toBe(true)
  if (missing.success) expect("absent" in missing.data).toBe(true)
})

test("e2e checkpoint reads treat invalid files as absent with a reason", async () => {
  const directory = await e2eTestTemporaryDirCreate()
  const invalidJson = `${directory}/invalid.json`
  await Bun.write(invalidJson, "{not json")
  const invalid = e2eCheckpointRead(invalidJson)
  expect(invalid.success).toBe(true)
  if (invalid.success && "absent" in invalid.data) expect(invalid.data.reason).toBe("invalid-json")
  const invalidSchema = `${directory}/schema.json`
  await Bun.write(invalidSchema, JSON.stringify({ version: 2 }))
  const schema = e2eCheckpointRead(invalidSchema)
  expect(schema.success).toBe(true)
  if (schema.success && "absent" in schema.data) expect(schema.data.reason.startsWith("invalid-schema")).toBe(true)
  expect(v.safeParse(e2eCheckpointSchema, { version: 2 }).success).toBe(false)
})

test("e2e checkpoints go stale after 24 hours", () => {
  const startedAt = "2026-03-04T05:06:00.000Z"
  expect(e2eCheckpointIsStale({ startedAt }, new Date("2026-03-05T05:05:59.999Z"))).toBe(false)
  expect(e2eCheckpointIsStale({ startedAt }, new Date("2026-03-05T05:06:00.000Z"))).toBe(true)
})

test("e2e entity records append and dedupe by kind and id", async () => {
  const directory = await e2eTestTemporaryDirCreate()
  const path = e2eCheckpointPathGet(directory, "dev")
  const checkpoint = {
    baseUrl: "http://127.0.0.1:5190",
    completedSteps: [],
    completedSuites: [],
    entities: [],
    runId: "202603040506-abcdef",
    startedAt: "2026-03-04T05:06:00.000Z",
    target: "dev" as const,
    values: {},
    version: 1 as const,
  }
  expect(e2eCheckpointWrite(path, checkpoint).success).toBe(true)
  const entity = { createdAt: "2026-03-04T05:06:00.000Z", id: "user-1", kind: "user" as const, name: "owner" }
  const first = e2eEntityRecord(path, entity)
  expect(first.success).toBe(true)
  const second = e2eEntityRecord(path, entity)
  expect(second.success).toBe(true)
  if (second.success) expect(second.data.entities).toHaveLength(1)
  const missingPath = `${directory}/missing/checkpoint.json`
  expect(e2eEntityRecord(missingPath, entity).success).toBe(false)
})

test("e2e step runs skip completed steps and persist progress after each run", async () => {
  const directory = await e2eTestTemporaryDirCreate()
  const path = e2eCheckpointPathGet(directory, "dev")
  const startedAt = "2026-03-04T05:06:00.000Z"
  const checkpoint = {
    baseUrl: "http://127.0.0.1:5190",
    completedSteps: ["already-done"],
    completedSuites: [],
    entities: [],
    runId: "202603040506-abcdef",
    startedAt,
    target: "dev" as const,
    values: {},
    version: 1 as const,
  }
  expect(e2eCheckpointWrite(path, checkpoint).success).toBe(true)
  const calls: string[] = []
  const step = async (title: string, body: () => Promise<void>) => {
    calls.push(title)
    await body()
  }
  let executed = 0
  await e2eStepRun({
    checkpointPath: path,
    run: async () => {
      executed += 1
    },
    step,
    stepName: "already-done",
  })
  expect(executed).toBe(0)
  await e2eStepRun({
    checkpointPath: path,
    run: async () => {
      executed += 1
    },
    step,
    stepName: "fresh-step",
  })
  expect(executed).toBe(1)
  expect(calls).toEqual(["fresh-step"])
  const persisted = e2eCheckpointRead(path)
  expect(persisted.success).toBe(true)
  if (persisted.success && "checkpoint" in persisted.data)
    expect(persisted.data.checkpoint.completedSteps).toEqual(["already-done", "fresh-step"])
})

test("e2e step runs persist before injected failures so resume skips the step", async () => {
  const directory = await e2eTestTemporaryDirCreate()
  const path = e2eCheckpointPathGet(directory, "dev")
  const checkpoint = {
    baseUrl: "http://127.0.0.1:5190",
    completedSteps: [],
    completedSuites: [],
    entities: [],
    runId: "202603040506-abcdef",
    startedAt: "2026-03-04T05:06:00.000Z",
    target: "dev" as const,
    values: {},
    version: 1 as const,
  }
  expect(e2eCheckpointWrite(path, checkpoint).success).toBe(true)
  const step = async (_title: string, body: () => Promise<void>) => {
    await body()
  }
  const faultEnvironment = { AUTHWORKS_E2E_FAIL_AFTER_STEP: "flaky-step" }
  const original = process.env.AUTHWORKS_E2E_FAIL_AFTER_STEP
  process.env.AUTHWORKS_E2E_FAIL_AFTER_STEP = faultEnvironment.AUTHWORKS_E2E_FAIL_AFTER_STEP
  try {
    await expect(
      e2eStepRun({ checkpointPath: path, run: async () => {}, step, stepName: "flaky-step" }),
    ).rejects.toThrow("Injected E2E failure")
  } finally {
    if (original === undefined) delete process.env.AUTHWORKS_E2E_FAIL_AFTER_STEP
    else process.env.AUTHWORKS_E2E_FAIL_AFTER_STEP = original
  }
  const persisted = e2eCheckpointRead(path)
  expect(persisted.success).toBe(true)
  if (persisted.success && "checkpoint" in persisted.data)
    expect(persisted.data.checkpoint.completedSteps).toEqual(["flaky-step"])
  let executed = 0
  await e2eStepRun({
    checkpointPath: path,
    run: async () => {
      executed += 1
    },
    step,
    stepName: "flaky-step",
  })
  expect(executed).toBe(0)
})

async function e2eTestTemporaryDirCreate(): Promise<string> {
  const prefix = `${process.env.TMPDIR ?? "/tmp"}/authworks-e2e-harness-test-`
  const directory = await Bun.file(`${prefix}marker`)
    .exists()
    .then(() => `${prefix}${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const { mkdir } = await import("node:fs/promises")
  await mkdir(directory, { recursive: true })
  return directory
}
