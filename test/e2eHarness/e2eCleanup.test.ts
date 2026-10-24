import { expect, test } from "bun:test"
import { e2eCheckpointIsStale } from "../../e2e/harness/e2eCheckpointIsStale.js"
import { e2eCleanupSelect } from "../../e2e/harness/e2eCleanupSelect.js"
import { e2eStateDirResolve } from "../../e2e/harness/e2eStateDirResolve.js"

const serviceUserName = "authworks-e2e-service"

const now = new Date("2026-10-26T00:00:00.000Z")

test("cleanup selection takes entities older than 24h across kinds", () => {
  const selected = e2eCleanupSelect({
    currentRunIds: new Set(),
    entities: [
      {
        createdAt: new Date("2026-10-24T20:00:00.000Z").getTime(),
        id: "u1",
        kind: "user",
        name: "e2e-aw-202610242000-old111-x",
      },
      {
        createdAt: new Date("2026-10-24T20:00:00.000Z").getTime(),
        id: "o1",
        kind: "organization",
        name: "e2e-aw-202610242000-old111-y",
      },
      {
        createdAt: new Date("2026-10-24T20:00:00.000Z").getTime(),
        id: "p1",
        kind: "project",
        name: "e2e-aw-202610242000-old111-z",
      },
    ],
    now,
    outcome: "failure",
    runId: "202610260000-cur001",
    serviceUserName,
  })
  expect(selected.users.map((user) => user.id)).toEqual(["u1"])
  expect(selected.organizations.map((organization) => organization.id)).toEqual(["o1"])
  expect(selected.projects.map((project) => project.id)).toEqual(["p1"])
})

test("cleanup selection skips fresh names on failure but takes the current run on success", () => {
  const fresh = { createdAt: now.getTime(), id: "u9", kind: "user" as const, name: "e2e-aw-202610260000-cur001-fresh" }
  const failed = e2eCleanupSelect({
    currentRunIds: new Set(),
    entities: [fresh],
    now,
    outcome: "failure",
    runId: "202610260000-cur001",
    serviceUserName,
  })
  expect(failed.users).toEqual([])
  const succeeded = e2eCleanupSelect({
    currentRunIds: new Set(),
    entities: [fresh],
    now,
    outcome: "success",
    runId: "202610260000-cur001",
    serviceUserName,
  })
  expect(succeeded.users.map((user) => user.id)).toEqual(["u9"])
})

test("cleanup selection takes current-run checkpoint ids on success only for matching names", () => {
  const succeeded = e2eCleanupSelect({
    currentRunIds: new Set(["u7"]),
    entities: [{ createdAt: now.getTime(), id: "u7", kind: "user", name: "e2e-aw-202610260000-cur001-x" }],
    now,
    outcome: "success",
    runId: "202610260000-other0",
    serviceUserName,
  })
  expect(succeeded.users.map((user) => user.id)).toEqual(["u7"])
  const failed = e2eCleanupSelect({
    currentRunIds: new Set(["u7"]),
    entities: [{ createdAt: now.getTime(), id: "u7", kind: "user", name: "e2e-aw-202610260000-cur001-x" }],
    now,
    outcome: "failure",
    runId: "202610260000-other0",
    serviceUserName,
  })
  expect(failed.users).toEqual([])
})

test("cleanup selection never takes non-matching names, the service user, or other kinds", () => {
  const selected = e2eCleanupSelect({
    currentRunIds: new Set(["s1", "m1"]),
    entities: [
      { createdAt: new Date("2026-10-20T00:00:00.000Z").getTime(), id: "real", kind: "user", name: "real-person" },
      { createdAt: new Date("2026-10-20T00:00:00.000Z").getTime(), id: "s1", kind: "user", name: serviceUserName },
      { createdAt: "2026-10-20T00:00:00.000Z", id: "m1", kind: "membership", name: "e2e-aw-202610200000-old111-m" },
    ],
    now,
    outcome: "success",
    runId: "202610260000-cur001",
    serviceUserName,
  })
  expect(selected.users).toEqual([])
  expect(selected.organizations).toEqual([])
  expect(selected.projects).toEqual([])
})

test("cleanup selection requires both the name timestamp and server createdAt to be stale", () => {
  const selected = e2eCleanupSelect({
    currentRunIds: new Set(),
    entities: [
      // Old name but freshly created on the server (clock race): keep.
      { createdAt: now.getTime(), id: "u2", kind: "user", name: "e2e-aw-202610200000-old111-x" },
    ],
    now,
    outcome: "failure",
    runId: undefined,
    serviceUserName,
  })
  expect(selected.users).toEqual([])
})

test("cleanup selection includes already soft-deleted users matching the stale e2e pattern", () => {
  const selected = e2eCleanupSelect({
    currentRunIds: new Set(),
    entities: [
      // Soft-deleted users disappear from the default list, so they arrive here from the
      // state=deleted listing; selection uses the same age and run rules.
      {
        createdAt: new Date("2026-10-24T20:00:00.000Z").getTime(),
        id: "u3",
        kind: "user",
        name: "e2e-aw-202610242000-old111-x",
      },
    ],
    now,
    outcome: "failure",
    runId: undefined,
    serviceUserName,
  })
  expect(selected.users.map((user) => user.id)).toEqual(["u3"])
})

test("cleanup checkpoints count as stale only after 24h", () => {
  expect(e2eCheckpointIsStale({ startedAt: "2026-10-25T12:00:00.000Z" }, now)).toBe(false)
  expect(e2eCheckpointIsStale({ startedAt: "2026-10-24T23:59:59.000Z" }, now)).toBe(true)
  const resolved = e2eStateDirResolve({ AUTHWORKS_E2E_STATE_DIR: "/tmp/e2e-cleanup-test" })
  expect(resolved.success).toBe(true)
  if (resolved.success) expect(resolved.data).toBe("/tmp/e2e-cleanup-test")
})
