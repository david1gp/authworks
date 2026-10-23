import {
  e2eDevEnvironmentEnsure,
  e2eDevEnvironmentStatusGet,
  e2eDevEnvironmentStop,
} from "../e2e/harness/e2eDevEnvironmentEnsure.js"
import { e2eStateDirResolve } from "../e2e/harness/e2eStateDirResolve.js"

const command = process.argv[2]
const flags = process.argv.slice(3)
const rebuild = flags.includes("--rebuild")

const stateDir = e2eStateDirResolve()
if (!stateDir.success) {
  console.error(stateDir.errorMessage)
  process.exit(2)
}

if (command === "start") {
  const ensured = await e2eDevEnvironmentEnsure({ stateDir: stateDir.data, ...(rebuild ? { rebuild: true } : {}) })
  if (!ensured.success) {
    console.error(ensured.errorMessage)
    process.exit(1)
  }
  process.stdout.write(
    `${JSON.stringify({
      baseUrl: ensured.data.baseUrl,
      memberUserName: ensured.data.memberUser.userName,
      organizationId: ensured.data.organizationId,
      realmId: ensured.data.realmId,
      serviceUserName: ensured.data.serviceUser.userName,
      stateDir: ensured.data.stateDir,
      status: "started",
    })}\n`,
  )
} else if (command === "status") {
  const status = e2eDevEnvironmentStatusGet(stateDir.data)
  process.stdout.write(
    `${JSON.stringify({ pid: status.pid ?? null, running: status.running, status: status.running ? "running" : "stopped" })}\n`,
  )
} else if (command === "stop") {
  const stopped = e2eDevEnvironmentStop(stateDir.data)
  if (!stopped.success) {
    console.error(stopped.errorMessage)
    process.exit(1)
  }
  process.stdout.write(`${JSON.stringify({ status: "stopped" })}\n`)
} else {
  console.error("Usage: bun scripts/e2eDevEnvironment.ts start [--rebuild] | status | stop")
  process.exit(2)
}
