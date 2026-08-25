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

test("OIDC, MFA, impersonation, and passkeys expose the shared profile flag", async () => {
  for (const args of [
    ["oidc", "client-list"],
    ["mfa", "policy", "get"],
    ["impersonation", "start"],
    ["passkeys", "list"],
  ]) {
    const result = await cliRun(...args, "--help")
    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toContain("--profile NAME")
  }
})

test("remaining target command trees expose and consume connection profiles", async () => {
  for (const args of [
    ["machine-users", "list"],
    ["projects", "list"],
    ["whatsapp-otp", "availability"],
    ["zitadel-migration", "import"],
    ["zitadel-migration", "export"],
  ]) {
    const result = await cliRun(...args, "--help")
    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toContain("--profile NAME")
  }

  const directory = await mkdtemp(join(tmpdir(), "authworks-cli-remaining-profile-"))
  const configHome = join(directory, "config")
  const organizationId = "01900000-0000-7000-8000-000000000001"
  const projectId = "01900000-0000-7000-8000-000000000002"
  const realmId = "01900000-0000-7000-8000-000000000003"
  const requests: RequestRecord[] = []
  const server = Bun.serve({
    async fetch(request) {
      const url = new URL(request.url)
      requests.push({
        authorization: request.headers.get("authorization") ?? undefined,
        body: await request.text(),
        pathname: url.pathname,
      })
      if (url.pathname.endsWith("/machine-users")) return Response.json({ items: [] })
      if (url.pathname.endsWith("/projects"))
        return Response.json({
          project: {
            authorizationRequired: false,
            createdAt: 1,
            id: projectId,
            name: "Profile project",
            organizationId,
            projectAccessRequired: false,
            realmId,
            status: "active",
            updatedAt: 1,
          },
        })
      if (url.pathname.endsWith("/whatsapp-otp/availability")) return Response.json({ available: true })
      return Response.json({})
    },
    port: 0,
  })

  try {
    const profile = await connectionProfilesStoreCreate({
      environment: { XDG_CONFIG_HOME: configHome },
    }).connectionProfileSet("remaining", {
      organizationId,
      realmId,
      server: server.url.toString(),
      token: "profile-token",
    })
    expect(profile.success).toBe(true)
    const environment = {
      AUTHWORKS_ORGANIZATION_ID: undefined,
      AUTHWORKS_REALM_ID: undefined,
      AUTHWORKS_TOKEN: undefined,
      AUTHWORKS_URL: undefined,
      XDG_CONFIG_HOME: configHome,
      ZITADEL_API_URL: undefined,
      ZITADEL_SERVICE_ACCOUNT_TOKEN: undefined,
    }

    const machineUsers = await cliRunWithEnvironment(environment, "machine-users", "list", "--profile", "remaining")
    const projects = await cliRunWithEnvironment(
      environment,
      "projects",
      "create",
      "--profile",
      "remaining",
      "--name",
      "Profile project",
    )
    const whatsapp = await cliRunWithEnvironment(environment, "whatsapp-otp", "availability", "--profile", "remaining")

    expect(machineUsers.exitCode).toBe(0)
    expect(projects.exitCode).toBe(0)
    expect(whatsapp.exitCode).toBe(0)
    expect(requests).toEqual([
      {
        authorization: "Bearer profile-token",
        body: "",
        pathname: `/system/realms/${realmId}/machine-users`,
      },
      {
        authorization: "Bearer profile-token",
        body: `{"authorizationRequired":false,"name":"Profile project","organizationId":"${organizationId}","projectAccessRequired":false}`,
        pathname: `/system/realms/${realmId}/projects`,
      },
      {
        authorization: undefined,
        body: "",
        pathname: `/realms/${realmId}/whatsapp-otp/availability`,
      },
    ])

    const zitadelImport = await cliRunWithEnvironment(
      environment,
      "zitadel-migration",
      "import",
      "--profile",
      "remaining",
      "--database",
      join(directory, "authworks.sqlite"),
      "--input",
      join(directory, "missing-snapshot.json"),
    )
    expect(zitadelImport.exitCode).not.toBe(0)
    expect(zitadelImport.stderr).toBe("The migration snapshot could not be read.\n")

    const zitadelExport = await cliRunWithEnvironment(
      environment,
      "zitadel-migration",
      "export",
      "--profile",
      "remaining",
    )
    expect(zitadelExport.exitCode).not.toBe(0)
    expect(zitadelExport.stdout).toBe("")
    expect(zitadelExport.stderr).toContain("Missing ZITADEL API URL")
    expect(zitadelExport.stderr).not.toContain("profile-token")
    expect(zitadelExport.stderr).not.toContain(server.url.toString())
  } finally {
    server.stop(true)
    await rm(directory, { force: true, recursive: true })
  }
})

test("target CLI commands resolve profile connections and preserve system-secret precedence", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-cli-target-profile-"))
  const configHome = join(directory, "config")
  const requests: RequestRecord[] = []
  let failNext = false
  const server = Bun.serve({
    async fetch(request) {
      const url = new URL(request.url)
      const body = await request.text()
      requests.push({
        authorization: request.headers.get("authorization") ?? undefined,
        body,
        pathname: url.pathname,
      })
      if (failNext) {
        failNext = false
        return Response.json(
          {
            error: {
              code: "platform.http",
              message: "The request failed while using profile-token.",
              status: 500,
            },
          },
          { status: 500 },
        )
      }
      if (url.pathname.endsWith("/oidc/clients")) return Response.json({ items: [] })
      if (url.pathname.endsWith("/mfa-policy"))
        return Response.json({ policy: { lockoutDurationMs: 60_000, maxAttempts: 5, mode: "required", totpWindow: 1 } })
      if (url.pathname.endsWith("/mfa/totp/enroll"))
        return Response.json({
          enrollment: { confirmedAt: null, id: "enrollment", label: "CLI", status: "pending", userId: "user" },
          otpauthUri: "otpauth://totp/Authworks:CLI?secret=ABCDEFGHIJKLMNOP",
          secret: "ABCDEFGHIJKLMNOP",
        })
      if (url.pathname.endsWith("/impersonations"))
        return Response.json({
          session: {
            assurance: "authenticated",
            authenticationMethod: "impersonation",
            createdAt: 1,
            current: false,
            device: {},
            expiresAt: 2,
            id: "session",
            impersonationOrganizationId: "profile-organization",
            impersonationReason: "CLI test",
            impersonated: true,
            impersonatorId: "admin",
            lastUsedAt: 1,
            realmId: "profile-realm",
            revokedAt: null,
            subjectId: "user",
            subjectType: "user",
            userId: "user",
          },
          token: "issued-session-token",
        })
      if (url.pathname.endsWith("/passkeys")) return Response.json({ items: [] })
      return Response.json({})
    },
    port: 0,
  })

  try {
    const profile = await connectionProfilesStoreCreate({
      environment: { XDG_CONFIG_HOME: configHome },
    }).connectionProfileSet("integration", {
      organizationId: "profile-organization",
      realmId: "profile-realm",
      server: server.url.toString(),
      token: "profile-token",
    })
    expect(profile.success).toBe(true)

    const environment = {
      AUTHWORKS_ORGANIZATION_ID: undefined,
      AUTHWORKS_REALM_ID: undefined,
      AUTHWORKS_SYSTEM_SECRET: undefined,
      AUTHWORKS_TOKEN: undefined,
      AUTHWORKS_URL: undefined,
      XDG_CONFIG_HOME: configHome,
    }
    const oidc = await cliRunWithEnvironment(environment, "oidc", "client-list", "--profile", "integration")
    const mfa = await cliRunWithEnvironment(environment, "mfa", "enroll", "--profile", "integration", "--label", "CLI")
    const impersonation = await cliRunWithEnvironment(
      environment,
      "impersonation",
      "start",
      "--profile",
      "integration",
      "--duration-seconds",
      "60",
      "--reason",
      "CLI test",
      "--target-user-id",
      "user",
    )
    const passkeys = await cliRunWithEnvironment(environment, "passkeys", "list", "--profile", "integration")

    expect(oidc.exitCode).toBe(0)
    expect(mfa.exitCode).toBe(0)
    expect(impersonation.exitCode).toBe(0)
    expect(passkeys.exitCode).toBe(0)
    expect(requests).toEqual([
      { authorization: "Bearer profile-token", body: "", pathname: "/system/realms/profile-realm/oidc/clients" },
      {
        authorization: "Bearer profile-token",
        body: '{"label":"CLI"}',
        pathname: "/realms/profile-realm/mfa/totp/enroll",
      },
      {
        authorization: "Bearer profile-token",
        body: '{"durationSeconds":60,"organizationId":"profile-organization","reason":"CLI test","targetUserId":"user"}',
        pathname: "/realms/profile-realm/impersonations",
      },
      { authorization: "Bearer profile-token", body: "", pathname: "/realms/profile-realm/passkeys" },
    ])

    const systemFlag = await cliRunWithEnvironment(
      environment,
      "mfa",
      "policy",
      "get",
      "--profile",
      "integration",
      "--system-token",
      "flag-system-token",
    )
    expect(systemFlag.exitCode).toBe(0)
    expect(requests.at(-1)?.authorization).toBe("Bearer flag-system-token")

    const systemEnvironment = { ...environment, AUTHWORKS_SYSTEM_SECRET: "environment-system-token" }
    const systemEnv = await cliRunWithEnvironment(systemEnvironment, "mfa", "policy", "get", "--profile", "integration")
    expect(systemEnv.exitCode).toBe(0)
    expect(requests.at(-1)?.authorization).toBe("Bearer environment-system-token")

    const explicit = await cliRunWithEnvironment(
      { ...environment, AUTHWORKS_REALM_ID: "environment-realm", AUTHWORKS_TOKEN: "environment-token" },
      "passkeys",
      "list",
      "--profile",
      "integration",
      "--realm-id",
      "flag-realm",
      "--token",
      "flag-token",
    )
    expect(explicit.exitCode).toBe(0)
    expect(requests.at(-1)).toMatchObject({
      authorization: "Bearer flag-token",
      pathname: "/realms/flag-realm/passkeys",
    })

    failNext = true
    const failed = await cliRunWithEnvironment(environment, "passkeys", "list", "--profile", "integration")
    expect(failed.exitCode).not.toBe(0)
    expect(failed.stdout).not.toContain("profile-token")
    expect(failed.stderr).not.toContain("profile-token")
    expect(failed.stderr).toContain("[REDACTED]")
  } finally {
    server.stop(true)
    await rm(directory, { force: true, recursive: true })
  }
})

async function cliRun(...args: string[]): Promise<CliRun> {
  return cliRunWithEnvironment({}, ...args)
}

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
  return { exitCode, stderr, stdout }
}
