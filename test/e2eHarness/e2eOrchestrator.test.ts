import { expect, test } from "bun:test"
import { e2eCheckpointPathGet } from "../../e2e/harness/e2eCheckpointPathGet.js"
import type { E2eCheckpoint } from "../../e2e/harness/e2eCheckpointSchema.js"
import { e2eCheckpointWrite } from "../../e2e/harness/e2eCheckpointWrite.js"
import { e2eCleanupRun } from "../../e2e/harness/e2eCleanupRun.js"
import { e2eCredentialsResolve } from "../../e2e/harness/e2eCredentialsResolve.js"
import { e2eRunResumeDecide } from "../../e2e/harness/e2eRunResumeDecide.js"
import { e2eSuiteRegistryList } from "../../e2e/harness/e2eSuiteRegistryList.js"
import { e2eSuiteRegistryPendingFilter } from "../../e2e/harness/e2eSuiteRegistryPendingFilter.js"
import { e2eSuiteRegistryTargetFilter } from "../../e2e/harness/e2eSuiteRegistryTargetFilter.js"
import { e2eTargetBaseUrlGet } from "../../e2e/harness/e2eTargetBaseUrlGet.js"

const productionBaseUrl = "https://authworks.contentoren.de"

const devBaseUrl = "http://login.localhost:5190"

function e2eOrchestratorCheckpointCreate(overrides: Partial<E2eCheckpoint> = {}): E2eCheckpoint {
  return {
    baseUrl: productionBaseUrl,
    completedSteps: [],
    completedSuites: [],
    entities: [],
    runId: "202603040506-abcdef",
    startedAt: "2026-03-04T05:06:00.000Z",
    target: "production",
    values: {},
    version: 1,
    ...overrides,
  }
}

test("e2e orchestrator resumes only for the same target, base URL, and a fresh checkpoint", () => {
  const now = new Date("2026-03-04T06:00:00.000Z")
  expect(e2eRunResumeDecide({ baseUrl: productionBaseUrl, checkpoint: undefined, now, target: "production" })).toBe(
    "new",
  )
  expect(
    e2eRunResumeDecide({
      baseUrl: productionBaseUrl,
      checkpoint: e2eOrchestratorCheckpointCreate(),
      now,
      target: "production",
    }),
  ).toBe("resume")
  expect(
    e2eRunResumeDecide({
      baseUrl: productionBaseUrl,
      checkpoint: e2eOrchestratorCheckpointCreate({ baseUrl: devBaseUrl }),
      now,
      target: "production",
    }),
  ).toBe("new")
  expect(
    e2eRunResumeDecide({
      baseUrl: productionBaseUrl,
      checkpoint: e2eOrchestratorCheckpointCreate({ target: "dev" }),
      now,
      target: "production",
    }),
  ).toBe("new")
  expect(
    e2eRunResumeDecide({
      baseUrl: productionBaseUrl,
      checkpoint: e2eOrchestratorCheckpointCreate({ startedAt: "2026-03-03T05:00:00.000Z" }),
      now,
      target: "production",
    }),
  ).toBe("stale")
})

test("e2e target base URL prefers the orchestrator override and falls back to production", () => {
  expect(e2eTargetBaseUrlGet({})).toBe(productionBaseUrl)
  expect(e2eTargetBaseUrlGet({ AUTHWORKS_E2E_BASE_URL: "" })).toBe(productionBaseUrl)
  expect(e2eTargetBaseUrlGet({ AUTHWORKS_E2E_BASE_URL: devBaseUrl })).toBe(devBaseUrl)
})

test("e2e suite registry orders local suites before live specs on both targets", () => {
  const registry = e2eSuiteRegistryList({ workflowExists: () => false })
  const kinds = registry.map((suite) => suite.kind)
  const firstLive = kinds.indexOf("live")
  expect(firstLive).toBeGreaterThan(0)
  expect(kinds.slice(firstLive)).toEqual(kinds.slice(firstLive).filter((kind) => kind === "live"))
  for (const target of ["production", "dev"] as const) {
    const filtered = e2eSuiteRegistryTargetFilter(registry, target)
    expect(filtered.map((suite) => suite.name)).toEqual(registry.map((suite) => suite.name))
  }
  expect(registry.map((suite) => suite.name)).toEqual([
    "login",
    "account",
    "admin-local",
    "task17-advanced",
    "accessibility",
    "productionAuthentication",
    "productionAccountRegression",
  ])
})

test("e2e suite registry excludes live workflow suites whose folder is missing", () => {
  const present = e2eSuiteRegistryList({ workflowExists: (name) => name === "adminOrgOwner" })
  expect(present.some((suite) => suite.name === "adminOrgOwner")).toBe(true)
  expect(present.some((suite) => suite.name === "adminInvitations")).toBe(false)
  const invitations = e2eSuiteRegistryList({ workflowExists: () => true })
  const devOnly = invitations.find((suite) => suite.name === "adminInvitations")
  expect(devOnly?.targets).toEqual(["dev"])
  expect(
    e2eSuiteRegistryTargetFilter(invitations, "production").some((suite) => suite.name === "adminInvitations"),
  ).toBe(false)
  expect(e2eSuiteRegistryTargetFilter(invitations, "dev").some((suite) => suite.name === "adminInvitations")).toBe(true)
})

test("e2e suite resume skips completed suites in registry order", () => {
  const registry = e2eSuiteRegistryList({ workflowExists: () => false })
  const pending = e2eSuiteRegistryPendingFilter(registry, ["login", "productionAuthentication"])
  expect(pending.map((suite) => suite.name)).toEqual([
    "account",
    "admin-local",
    "task17-advanced",
    "accessibility",
    "productionAccountRegression",
  ])
  expect(
    e2eSuiteRegistryPendingFilter(
      registry,
      registry.map((suite) => suite.name),
    ),
  ).toEqual([])
})

test("e2e credentials resolve production members without touching the service user", () => {
  const resolved = e2eCredentialsResolve({
    environment: { AUTHWORKS_SSOTEST_PASSWORD: "secret", AUTHWORKS_SSOTEST_USERNAME: "tester" },
    target: "production",
  })
  expect(resolved.success).toBe(true)
  if (resolved.success) {
    expect(resolved.data.memberUsername).toBe("tester")
    expect(resolved.data.serviceUsername).toBe(undefined)
  }
  expect(
    e2eCredentialsResolve({
      environment: { AUTHWORKS_SSOTEST_PASSWORD: "", AUTHWORKS_SSOTEST_USERNAME: "tester" },
      target: "production",
    }).success,
  ).toBe(false)
})

test("e2e credentials resolve dev members and the service user from the dev env file", async () => {
  const directory = await e2eOrchestratorTestDirCreate()
  await Bun.write(
    `${directory}/dev/env.json`,
    JSON.stringify({ memberPassword: "member-secret", servicePassword: "service-secret", systemSecret: "system" }),
  )
  const resolved = e2eCredentialsResolve({ stateDir: directory, target: "dev" })
  expect(resolved.success).toBe(true)
  if (resolved.success) {
    expect(resolved.data.memberUsername).toBe("e2e-dev-member")
    expect(resolved.data.memberPassword).toBe("member-secret")
    expect(resolved.data.serviceUsername).toBe("authworks-e2e-service")
    expect(resolved.data.servicePassword).toBe("service-secret")
  }
  expect(e2eCredentialsResolve({ stateDir: `${directory}/missing`, target: "dev" }).success).toBe(false)
  expect(e2eCredentialsResolve({ target: "dev" }).success).toBe(false)
})

test("e2e cleanup hook resolves for every outcome until task 18b lands", async () => {
  const checkpoint = e2eOrchestratorCheckpointCreate()
  for (const outcome of ["success", "failure", "interrupted"] as const) {
    const cleanup = await e2eCleanupRun({ checkpoint, outcome, target: "production" })
    expect(cleanup.success).toBe(true)
  }
})

test("e2e run checkpoints persist suite progress across orchestrator restarts", async () => {
  const directory = await e2eOrchestratorTestDirCreate()
  const path = e2eCheckpointPathGet(directory, "production")
  const checkpoint = e2eOrchestratorCheckpointCreate({ completedSuites: ["login"] })
  expect(e2eCheckpointWrite(path, checkpoint).success).toBe(true)
  const pending = e2eSuiteRegistryPendingFilter(
    e2eSuiteRegistryTargetFilter(e2eSuiteRegistryList({ workflowExists: () => false }), "production"),
    checkpoint.completedSuites,
  )
  expect(pending[0]?.name).toBe("account")
})

async function e2eOrchestratorTestDirCreate(): Promise<string> {
  const { mkdir } = await import("node:fs/promises")
  const directory = `${process.env.TMPDIR ?? "/tmp"}/authworks-e2e-orchestrator-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  await mkdir(`${directory}/dev`, { recursive: true })
  return directory
}
