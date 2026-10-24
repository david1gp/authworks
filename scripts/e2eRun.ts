import { spawn } from "node:child_process"
import { e2eCheckpointClear } from "../e2e/harness/e2eCheckpointClear.js"
import { e2eCheckpointPathGet } from "../e2e/harness/e2eCheckpointPathGet.js"
import { e2eCheckpointRead } from "../e2e/harness/e2eCheckpointRead.js"
import type { E2eCheckpoint } from "../e2e/harness/e2eCheckpointSchema.js"
import { e2eCheckpointWrite } from "../e2e/harness/e2eCheckpointWrite.js"
import { e2eCleanupRun } from "../e2e/harness/e2eCleanupRun.js"
import { e2eCredentialsResolve } from "../e2e/harness/e2eCredentialsResolve.js"
import { e2eDevEnvironmentEnsure, e2eDevEnvironmentStatusGet } from "../e2e/harness/e2eDevEnvironmentEnsure.js"
import { e2eRunIdCreate } from "../e2e/harness/e2eRunIdCreate.js"
import { e2eRunResumeDecide } from "../e2e/harness/e2eRunResumeDecide.js"
import { e2eStateDirResolve } from "../e2e/harness/e2eStateDirResolve.js"
import { type E2eSuite, e2eSuiteRegistryList } from "../e2e/harness/e2eSuiteRegistryList.js"
import { e2eSuiteRegistryPendingFilter } from "../e2e/harness/e2eSuiteRegistryPendingFilter.js"
import { e2eSuiteRegistryTargetFilter } from "../e2e/harness/e2eSuiteRegistryTargetFilter.js"
import { e2eTargetResolve } from "../e2e/harness/e2eTargetResolve.js"
import type { E2eTarget } from "../e2e/harness/e2eTargetSchema.js"

type E2eRunOptions = {
  readonly fresh: boolean
  readonly only: string | undefined
  readonly rebuildUi: boolean
  readonly target: E2eTarget
}

const usage = "Usage: bun scripts/e2eRun.ts --target production|dev [--fresh] [--only <suite>] [--rebuild]"

async function e2eRunScriptMain(): Promise<number> {
  const parsed = e2eRunOptionsParse(process.argv.slice(2))
  if (!parsed.success) {
    process.stderr.write(`${parsed.errorMessage}\n${usage}\n`)
    return 2
  }
  const { fresh, only, rebuildUi, target } = parsed.data

  const stateDir = e2eStateDirResolve()
  if (!stateDir.success) {
    process.stderr.write(`${stateDir.errorMessage}\n`)
    return 2
  }
  const resolved = e2eTargetResolve({ AUTHWORKS_E2E_TARGET: target })
  if (!resolved.success) {
    process.stderr.write(`${resolved.errorMessage}\n`)
    return 2
  }
  const baseUrl = target === "dev" ? "http://login.localhost:5190" : resolved.data.baseUrl
  const checkpointPath = e2eCheckpointPathGet(stateDir.data, target)
  const read = e2eCheckpointRead(checkpointPath)
  if (!read.success) {
    process.stderr.write(`${read.errorMessage}\n`)
    return 1
  }
  const existing = "checkpoint" in read.data ? read.data.checkpoint : undefined
  const decision = fresh ? "new" : e2eRunResumeDecide({ baseUrl, checkpoint: existing, target })
  let checkpoint: E2eCheckpoint
  if (decision === "resume" && existing !== undefined) {
    checkpoint = existing
    process.stdout.write(
      `Resuming E2E run ${checkpoint.runId} for ${target} (${checkpoint.baseUrl}); ` +
        `completed suites: ${checkpoint.completedSuites.length > 0 ? checkpoint.completedSuites.join(", ") : "none"}.\n`,
    )
  } else {
    if (existing !== undefined && (decision === "stale" || fresh)) {
      const cleanup = await e2eCleanupRun({ baseUrl, checkpoint: existing, outcome: "interrupted", target })
      if (!cleanup.success) process.stderr.write(`Stale-run cleanup reported: ${cleanup.errorMessage}\n`)
      process.stdout.write(
        decision === "stale" && !fresh
          ? `Previous E2E checkpoint for ${target} is stale; starting a new run.\n`
          : `Discarding the previous E2E checkpoint for ${target}; starting a new run.\n`,
      )
    } else if (existing !== undefined) {
      process.stdout.write(`Previous E2E checkpoint for ${target} targets ${existing.baseUrl}; starting a new run.\n`)
    }
    const runId = e2eRunIdCreate()
    checkpoint = {
      baseUrl,
      completedSteps: [],
      completedSuites: [],
      entities: [],
      runId,
      startedAt: new Date().toISOString(),
      target,
      values: {},
      version: 1,
    }
    const written = e2eCheckpointWrite(checkpointPath, checkpoint)
    if (!written.success) {
      process.stderr.write(`${written.errorMessage}\n`)
      return 1
    }
    process.stdout.write(`Starting E2E run ${runId} for ${target} (${baseUrl}).\n`)
  }

  let devStop: (() => Promise<void>) | undefined
  let outcome: "failure" | "interrupted" | "success" = "failure"
  const markInterrupted = (): void => {
    outcome = "interrupted"
  }
  process.on("SIGINT", markInterrupted)
  process.on("SIGTERM", markInterrupted)
  try {
    if (target === "dev") {
      const ensured = await e2eDevEnvironmentEnsure({ rebuild: rebuildUi, stateDir: stateDir.data })
      if (!ensured.success) {
        process.stderr.write(`${ensured.errorMessage}\n`)
        return 1
      }
      const status = e2eDevEnvironmentStatusGet(stateDir.data)
      process.stdout.write(`Dev target ready at ${ensured.data.baseUrl} (pid ${status.pid ?? "unknown"}).\n`)
      devStop = ensured.data.stop
    }

    const registry = e2eSuiteRegistryTargetFilter(e2eSuiteRegistryList(), target)
    const pending = e2eSuiteRegistryPendingFilter(registry, checkpoint.completedSuites)
    const selected = only === undefined ? pending : pending.filter((suite) => suite.name === only)
    if (only !== undefined && selected.length === 0) {
      if (!registry.some((suite) => suite.name === only)) {
        const known = registry.map((suite) => suite.name).join(", ")
        process.stderr.write(`Unknown E2E suite "${only}". Known suites for ${target}: ${known}.\n`)
        return 2
      }
      process.stdout.write(`Suite "${only}" is already complete for this run.\n`)
      outcome = "success"
    } else if (selected.length === 0) {
      process.stdout.write("All E2E suites are already complete for this run.\n")
      outcome = "success"
    } else {
      let allPassed = true
      for (const suite of selected) {
        if (outcome === "interrupted") {
          allPassed = false
          break
        }
        const suiteResult = await e2eSuiteRun({ baseUrl, checkpointPath, stateDir: stateDir.data, suite, target })
        if (suiteResult.interrupted) {
          outcome = "interrupted"
          allPassed = false
          break
        }
        if (!suiteResult.success) {
          process.stderr.write(`${suiteResult.errorMessage}\n`)
          allPassed = false
          break
        }
        const reread = e2eCheckpointRead(checkpointPath)
        if (!reread.success || !("checkpoint" in reread.data)) {
          process.stderr.write("The E2E checkpoint disappeared during the run.\n")
          allPassed = false
          break
        }
        checkpoint = {
          ...reread.data.checkpoint,
          completedSuites: [...reread.data.checkpoint.completedSuites, suite.name],
        }
        const persisted = e2eCheckpointWrite(checkpointPath, checkpoint)
        if (!persisted.success) {
          process.stderr.write(`${persisted.errorMessage}\n`)
          allPassed = false
          break
        }
        process.stdout.write(`Suite "${suite.name}" passed.\n`)
      }
      outcome = outcome === "interrupted" ? "interrupted" : allPassed ? "success" : "failure"
    }
    if (outcome === "success") {
      const cleared = e2eCheckpointClear(checkpointPath)
      if (!cleared.success) process.stderr.write(`${cleared.errorMessage}\n`)
      else process.stdout.write("E2E run complete; checkpoint cleared.\n")
    } else if (outcome === "failure") {
      process.stderr.write(`E2E run paused. Resume with: bun scripts/e2eRun.ts --target ${target}.\n`)
    }
    return outcome === "success" ? 0 : 1
  } finally {
    const finalRead = e2eCheckpointRead(checkpointPath)
    const finalCheckpoint = finalRead.success && "checkpoint" in finalRead.data ? finalRead.data.checkpoint : checkpoint
    const cleanup = await e2eCleanupRun({
      baseUrl,
      checkpoint: finalCheckpoint,
      outcome,
      stateDir: stateDir.data,
      target,
    })
    if (!cleanup.success) {
      process.stderr.write(`Cleanup hook reported: ${cleanup.errorMessage}\n`)
      process.exitCode = 1
    } else {
      process.stdout.write(
        `Cleanup removed ${cleanup.data.users} users, ${cleanup.data.organizations} organizations, ${cleanup.data.projects} projects.\n`,
      )
    }
    if (devStop !== undefined) {
      await devStop()
      process.stdout.write("Dev server stopped (state kept).\n")
    }
  }
}

type E2eSuiteRunInput = {
  readonly baseUrl: string
  readonly checkpointPath: string
  readonly stateDir: string
  readonly suite: E2eSuite
  readonly target: E2eTarget
}

type E2eSuiteRunResult = {
  readonly errorMessage?: string
  readonly interrupted: boolean
  readonly success: boolean
}

function e2eSuiteRun(input: E2eSuiteRunInput): Promise<E2eSuiteRunResult> {
  return new Promise((resolve) => {
    const credentials = e2eCredentialsResolve({ stateDir: input.stateDir, target: input.target })
    if (!credentials.success) {
      resolve({ errorMessage: credentials.errorMessage, interrupted: false, success: false })
      return
    }
    const environment: Record<string, string> = {
      AUTHWORKS_E2E_BASE_URL: input.baseUrl,
      AUTHWORKS_E2E_CHECKPOINT_PATH: input.checkpointPath,
      AUTHWORKS_E2E_RUN_ID: e2eCheckpointRunIdRead(input.checkpointPath),
      AUTHWORKS_E2E_SUITE_KIND: input.suite.kind,
      AUTHWORKS_E2E_TARGET: input.target,
      AUTHWORKS_SSOTEST_PASSWORD: credentials.data.memberPassword,
      AUTHWORKS_SSOTEST_USERNAME: credentials.data.memberUsername,
    }
    if (credentials.data.serviceUsername !== undefined && credentials.data.servicePassword !== undefined) {
      environment.AUTHWORKS_E2E_SERVICE_USERNAME = credentials.data.serviceUsername
      environment.AUTHWORKS_E2E_SERVICE_PASSWORD = credentials.data.servicePassword
    }
    const child = spawn("bunx", ["playwright", "test", ...input.suite.files], {
      env: {
        ...process.env,
        ...environment,
        ...(input.suite.kind === "live"
          ? { AUTHWORKS_E2E_TEST_MATCH: input.suite.files.map((file) => `**/${file.split("/").pop()}`).join(",") }
          : {}),
      },
      stdio: "inherit",
    })
    child.on("error", (error) => {
      resolve({
        errorMessage: `Suite "${input.suite.name}" could not start: ${error.message}`,
        interrupted: false,
        success: false,
      })
    })
    child.on("exit", (code, signal) => {
      if (signal === "SIGINT" || signal === "SIGTERM") {
        resolve({ interrupted: true, success: false })
        return
      }
      if (code === 0) {
        resolve({ interrupted: false, success: true })
        return
      }
      resolve({
        errorMessage: `Suite "${input.suite.name}" failed (exit ${code ?? "unknown"}).`,
        interrupted: false,
        success: false,
      })
    })
  })
}

function e2eCheckpointRunIdRead(checkpointPath: string): string {
  const read = e2eCheckpointRead(checkpointPath)
  if (read.success && "checkpoint" in read.data) return read.data.checkpoint.runId
  return ""
}

function e2eRunOptionsParse(argv: readonly string[]): {
  readonly data?: E2eRunOptions
  readonly errorMessage?: string
  readonly success: boolean
} {
  let target: string | undefined
  let only: string | undefined
  let fresh = false
  let rebuildUi = false
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (flag === "--target") {
      target = argv[index + 1]
      index += 1
    } else if (flag === "--only") {
      only = argv[index + 1]
      index += 1
    } else if (flag === "--fresh") {
      fresh = true
    } else if (flag === "--rebuild") {
      rebuildUi = true
    } else {
      return { errorMessage: `Unknown flag "${flag}".`, success: false }
    }
  }
  if (target !== "production" && target !== "dev")
    return { errorMessage: "A target is required: --target production|dev.", success: false }
  if (only !== undefined && only.length === 0) return { errorMessage: "--only requires a suite name.", success: false }
  return { data: { fresh, only, rebuildUi, target }, success: true }
}

const exitCode = await e2eRunScriptMain()
process.exit(exitCode)
