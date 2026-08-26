import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { connectionProfilesStoreCreate } from "../../src/features/connectionProfiles/persistence/connectionProfilesStoreCreate.js"

type CliRun = {
  readonly exitCode: number
  readonly stderr: string
  readonly stdout: string
}

type RequestRecord = {
  readonly authorization?: string
  readonly body: string
  readonly pathname: string
}

test("MFA system policy routes isolate profile auth while tenant enrollment keeps the profile bearer", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-cli-mfa-connection-profile-"))
  const configHome = join(directory, "config")
  const realmId = "01900000-0000-7000-8000-000000000001"
  const requests: RequestRecord[] = []
  const server = Bun.serve({
    async fetch(request) {
      const url = new URL(request.url)
      const authorization = request.headers.get("authorization") ?? undefined
      const body = await request.text()
      requests.push({ authorization, body, pathname: url.pathname })

      if (url.pathname.endsWith("/mfa-policy") && authorization === undefined)
        return Response.json(
          { error: { code: "mfa.unauthorized", message: "System authorization is required.", status: 401 } },
          { status: 401 },
        )
      if (url.pathname.endsWith("/mfa/totp/enroll"))
        return Response.json({
          enrollment: { confirmedAt: null, id: "enrollment", label: "CLI", status: "pending", userId: "user" },
          otpauthUri: "otpauth://totp/Authworks:CLI?secret=ABCDEFGHIJKLMNOP",
          secret: "ABCDEFGHIJKLMNOP",
        })
      return Response.json({
        policy: { lockoutDurationMs: 60_000, maxAttempts: 5, mode: "required", totpWindow: 1 },
      })
    },
    port: 0,
  })

  try {
    const profile = await connectionProfilesStoreCreate({
      environment: { XDG_CONFIG_HOME: configHome },
    }).connectionProfileSet("mfa", { realmId, server: server.url.toString(), token: "profile-token" })
    expect(profile.success).toBe(true)

    const environment = {
      AUTHWORKS_REALM_ID: undefined,
      AUTHWORKS_SYSTEM_SECRET: undefined,
      AUTHWORKS_TOKEN: "environment-token-must-be-ignored",
      AUTHWORKS_URL: undefined,
      XDG_CONFIG_HOME: configHome,
    }
    const policySetArgs = [
      "mfa",
      "policy",
      "set",
      "--profile",
      "mfa",
      "--mode",
      "required",
      "--totp-window",
      "1",
      "--max-attempts",
      "5",
      "--lockout-duration-ms",
      "60000",
    ]

    const profileGet = await cliRunWithEnvironment(environment, "mfa", "policy", "get", "--profile", "mfa")
    expect(profileGet.exitCode).not.toBe(0)
    expect(requests.at(-1)).toMatchObject({ authorization: undefined, pathname: `/realms/${realmId}/mfa-policy` })

    const profileSet = await cliRunWithEnvironment(environment, ...policySetArgs)
    expect(profileSet.exitCode).not.toBe(0)
    expect(requests.at(-1)).toMatchObject({
      authorization: undefined,
      pathname: `/system/realms/${realmId}/mfa-policy`,
    })

    const systemEnvironment = await cliRunWithEnvironment(
      { ...environment, AUTHWORKS_SYSTEM_SECRET: "environment-system-secret" },
      "mfa",
      "policy",
      "get",
      "--profile",
      "mfa",
    )
    expect(systemEnvironment.exitCode).toBe(0)
    expect(requests.at(-1)?.authorization).toBe("Bearer environment-system-secret")

    const systemFlag = await cliRunWithEnvironment(
      { ...environment, AUTHWORKS_SYSTEM_SECRET: "environment-system-secret" },
      ...policySetArgs,
      "--system-token",
      "flag-system-token",
    )
    expect(systemFlag.exitCode).toBe(0)
    expect(requests.at(-1)?.authorization).toBe("Bearer flag-system-token")

    const tokenCompatibility = await cliRunWithEnvironment(
      { ...environment, AUTHWORKS_SYSTEM_SECRET: "environment-system-secret" },
      "mfa",
      "policy",
      "get",
      "--profile",
      "mfa",
      "--token",
      "explicit-system-token",
    )
    expect(tokenCompatibility.exitCode).toBe(0)
    expect(requests.at(-1)?.authorization).toBe("Bearer explicit-system-token")

    const enrollment = await cliRunWithEnvironment(
      { ...environment, AUTHWORKS_TOKEN: undefined },
      "mfa",
      "enroll",
      "--profile",
      "mfa",
      "--label",
      "CLI",
    )
    expect(enrollment.exitCode).toBe(0)
    expect(requests.at(-1)).toMatchObject({
      authorization: "Bearer profile-token",
      body: '{"label":"CLI"}',
      pathname: `/realms/${realmId}/mfa/totp/enroll`,
    })
  } finally {
    server.stop(true)
    await rm(directory, { force: true, recursive: true })
  }
})

test("password change resolves profile connections and verify keeps its token as a payload", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-cli-password-connection-profile-"))
  const configHome = join(directory, "config")
  const realmId = "01900000-0000-7000-8000-000000000001"
  const requests: RequestRecord[] = []
  const server = Bun.serve({
    async fetch(request) {
      const url = new URL(request.url)
      const body = await request.text()
      requests.push({
        authorization: request.headers.get("authorization") ?? undefined,
        body,
        pathname: url.pathname,
      })
      if (url.pathname.endsWith("/verify-email"))
        return Response.json(
          {
            error: {
              code: "passwords.unauthorized",
              message: `Verification failed for ${body} and profile-token.`,
              status: 401,
            },
          },
          { status: 401 },
        )
      return Response.json({ changed: true })
    },
    port: 0,
  })

  try {
    const profile = await connectionProfilesStoreCreate({
      environment: { XDG_CONFIG_HOME: configHome },
    }).connectionProfileSet("passwords", { realmId, server: server.url.toString(), token: "profile-token" })
    expect(profile.success).toBe(true)

    const environment = {
      AUTHWORKS_REALM_ID: undefined,
      AUTHWORKS_SYSTEM_SECRET: undefined,
      AUTHWORKS_TOKEN: undefined,
      AUTHWORKS_URL: undefined,
      XDG_CONFIG_HOME: configHome,
    }
    const changed = await cliRunWithEnvironment(
      environment,
      "password",
      "change",
      "--profile",
      "passwords",
      "--user-id",
      "user",
      "--current-password",
      "old-password",
      "--new-password",
      "new-password",
    )
    expect(changed.exitCode).toBe(0)
    expect(requests.at(-1)).toEqual({
      authorization: "Bearer profile-token",
      body: '{"currentPassword":"old-password","newPassword":"new-password"}',
      pathname: `/realms/${realmId}/users/user/password`,
    })

    const payloadToken = "verification-payload-token-12345678901234567890"
    const verified = await cliRunWithEnvironment(
      environment,
      "password",
      "verify",
      "--profile",
      "passwords",
      "--token",
      payloadToken,
    )
    expect(verified.exitCode).not.toBe(0)
    expect(requests.at(-1)).toEqual({
      authorization: "Bearer profile-token",
      body: `{"token":"${payloadToken}"}`,
      pathname: `/realms/${realmId}/password/verify-email`,
    })
    expect(verified.stderr).not.toContain(payloadToken)
    expect(verified.stderr).not.toContain("profile-token")
  } finally {
    server.stop(true)
    await rm(directory, { force: true, recursive: true })
  }
})

async function cliRunWithEnvironment(environmentOverrides: Record<string, string | undefined>, ...args: string[]) {
  const environment = { ...process.env }
  for (const [name, value] of Object.entries(environmentOverrides)) {
    if (value === undefined) delete environment[name]
    else environment[name] = value
  }
  const child = Bun.spawn(["bun", "src/outputs/cli.ts", ...args], { env: environment, stderr: "pipe", stdout: "pipe" })
  const [exitCode, stderr, stdout] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
    new Response(child.stdout).text(),
  ])
  return { exitCode, stderr, stdout } satisfies CliRun
}
