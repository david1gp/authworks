import { e2eServiceUserEnsure } from "../e2e/harness/e2eServiceUserEnsure.js"
import {
  e2eServiceUserEnsureExitCodeGet,
  e2eServiceUserEnsureFailureOutputCreate,
} from "../e2e/harness/e2eServiceUserEnsureFailureOutputCreate.js"
import { e2eServiceUserStdinPasswordParse } from "../e2e/harness/e2eServiceUserStdinPasswordParse.js"

type E2eServiceUserEnsureRunOptions = {
  readonly argv: readonly string[]
  readonly environment: Readonly<Record<string, string | undefined>>
  readonly stdinRead: () => Promise<string>
}

// Documented stable exit codes (shared with e2eServiceUserEnsureFailureExitCodes):
// 0 = ensured (stdout is the status envelope); 1 = internal/api failure;
// 2 = environment or stdin failure; 32-39 = server-rejected stage;
// 44-51 = documented input/state failures; 52-65 = documented API failures.
function flagValueGet(argv: readonly string[], flag: string): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === flag) return argv[index + 1]
  }
  return undefined
}

async function e2eServiceUserEnsureScriptRun(options: E2eServiceUserEnsureRunOptions): Promise<number> {
  const baseUrl = processEnvTrimmed(options.environment.AUTHWORKS_URL)
  const systemSecret = processEnvTrimmed(options.environment.AUTHWORKS_SYSTEM_SECRET)
  const realmDomain = flagValueGet(options.argv, "--realm-domain")
  if (baseUrl === undefined || baseUrl.length === 0) {
    process.stderr.write(e2eServiceUserEnsureFailureOutputCreate("e2e.service-user-ensure.authorization-unavailable"))
    return e2eServiceUserEnsureExitCodeGet("e2e.service-user-ensure.authorization-unavailable")
  }
  if (systemSecret === undefined || systemSecret.length === 0) {
    process.stderr.write(e2eServiceUserEnsureFailureOutputCreate("e2e.service-user-ensure.authorization-unavailable"))
    return e2eServiceUserEnsureExitCodeGet("e2e.service-user-ensure.authorization-unavailable")
  }
  let rawStdin: string
  try {
    rawStdin = await options.stdinRead()
  } catch {
    process.stderr.write(e2eServiceUserEnsureFailureOutputCreate("e2e.service-user-ensure.input-invalid"))
    return e2eServiceUserEnsureExitCodeGet("e2e.service-user-ensure.input-invalid")
  }
  const password = e2eServiceUserStdinPasswordParse(rawStdin)
  if (!password.success) {
    process.stderr.write(e2eServiceUserEnsureFailureOutputCreate("e2e.service-user-ensure.input-invalid"))
    return e2eServiceUserEnsureExitCodeGet("e2e.service-user-ensure.input-invalid")
  }
  const realmId = flagValueGet(options.argv, "--realm-id")
  const ensured = await e2eServiceUserEnsure({
    baseUrl,
    password: password.data,
    ...(realmDomain === undefined || realmDomain === "" ? {} : { realmDomain: realmDomain.trim().toLowerCase() }),
    ...(realmId === undefined || realmId === "" ? {} : { realmId: realmId.trim() }),
    systemSecret,
  })
  if (!ensured.success) {
    process.stderr.write(e2eServiceUserEnsureFailureOutputCreate(ensured))
    return e2eServiceUserEnsureExitCodeGet(ensured)
  }
  process.stdout.write(
    `${JSON.stringify({ status: ensured.data.status, userId: ensured.data.userId, realmId: ensured.data.realmId })}\n`,
  )
  return 0
}

function processEnvTrimmed(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

const exitCode = await e2eServiceUserEnsureScriptRun({
  argv: process.argv.slice(2),
  environment: process.env,
  stdinRead: async () => Bun.stdin.text(),
})
process.exit(exitCode)
