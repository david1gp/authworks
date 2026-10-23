import { e2eServiceUserEnsure } from "../e2e/harness/e2eServiceUserEnsure.js"
import { e2eServiceUserStdinPasswordParse } from "../e2e/harness/e2eServiceUserStdinPasswordParse.js"

type E2eServiceUserEnsureRunOptions = {
  readonly argv: readonly string[]
  readonly environment: Readonly<Record<string, string | undefined>>
  readonly stdinRead: () => Promise<string>
}

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
    process.stderr.write(`${JSON.stringify({ error: { code: "config", message: "AUTHWORKS_URL is required." } })}\n`)
    return 2
  }
  if (systemSecret === undefined || systemSecret.length === 0) {
    process.stderr.write(
      `${JSON.stringify({ error: { code: "config", message: "AUTHWORKS_SYSTEM_SECRET is required." } })}\n`,
    )
    return 2
  }
  let rawStdin: string
  try {
    rawStdin = await options.stdinRead()
  } catch {
    process.stderr.write(
      `${JSON.stringify({ error: { code: "stdin", message: "The service-user password could not be read." } })}\n`,
    )
    return 2
  }
  const password = e2eServiceUserStdinPasswordParse(rawStdin)
  if (!password.success) {
    process.stderr.write(`${JSON.stringify({ error: { code: "stdin", message: password.errorMessage } })}\n`)
    return 2
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
    const code = ensured.code ?? "ensure-failed"
    process.stderr.write(`${JSON.stringify({ error: { code, message: ensured.errorMessage } })}\n`)
    return 1
  }
  process.stdout.write(
    `${JSON.stringify({ realmId: ensured.data.realmId, status: ensured.data.status, userId: ensured.data.userId })}\n`,
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
