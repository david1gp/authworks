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

test("remaining target command trees preserve profile scope resolution without using profile bearer tokens on system routes", async () => {
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
      AUTHWORKS_SYSTEM_SECRET: undefined,
      AUTHWORKS_TOKEN: "environment-token-must-be-ignored",
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
        authorization: undefined,
        body: "",
        pathname: `/system/realms/${realmId}/machine-users`,
      },
      {
        authorization: undefined,
        body: `{"authorizationRequired":false,"name":"Profile project","organizationId":"${organizationId}","projectAccessRequired":false}`,
        pathname: `/system/realms/${realmId}/projects`,
      },
      {
        authorization: undefined,
        body: "",
        pathname: `/realms/${realmId}/whatsapp-otp/availability`,
      },
    ])

    const machineUsersWithEnvironmentSecret = await cliRunWithEnvironment(
      { ...environment, AUTHWORKS_SYSTEM_SECRET: "environment-system-secret" },
      "machine-users",
      "list",
      "--profile",
      "remaining",
    )
    const projectsWithFlagPrecedence = await cliRunWithEnvironment(
      { ...environment, AUTHWORKS_SYSTEM_SECRET: "environment-system-secret" },
      "projects",
      "create",
      "--profile",
      "remaining",
      "--system-token",
      "flag-system-token",
      "--name",
      "Flag project",
    )
    expect(machineUsersWithEnvironmentSecret.exitCode).toBe(0)
    expect(projectsWithFlagPrecedence.exitCode).toBe(0)
    expect(requests.slice(3)).toEqual([
      {
        authorization: "Bearer environment-system-secret",
        body: "",
        pathname: `/system/realms/${realmId}/machine-users`,
      },
      {
        authorization: "Bearer flag-system-token",
        body: `{"authorizationRequired":false,"name":"Flag project","organizationId":"${organizationId}","projectAccessRequired":false}`,
        pathname: `/system/realms/${realmId}/projects`,
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
    const oidc = await cliRunWithEnvironment(
      { ...environment, AUTHWORKS_TOKEN: "environment-token-must-be-ignored" },
      "oidc",
      "client-list",
      "--profile",
      "integration",
    )
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
      { authorization: undefined, body: "", pathname: "/system/realms/profile-realm/oidc/clients" },
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

    const oidcSystemEnvironment = await cliRunWithEnvironment(
      { ...environment, AUTHWORKS_SYSTEM_SECRET: "environment-oidc-system-token" },
      "oidc",
      "client-list",
      "--profile",
      "integration",
    )
    const oidcSystemFlag = await cliRunWithEnvironment(
      { ...environment, AUTHWORKS_SYSTEM_SECRET: "environment-oidc-system-token" },
      "oidc",
      "client-list",
      "--profile",
      "integration",
      "--system-token",
      "flag-oidc-system-token",
    )
    expect(oidcSystemEnvironment.exitCode).toBe(0)
    expect(oidcSystemFlag.exitCode).toBe(0)
    expect(requests.at(-2)?.authorization).toBe("Bearer environment-oidc-system-token")
    expect(requests.at(-1)?.authorization).toBe("Bearer flag-oidc-system-token")

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

test("MFA policy set never uses profile or AUTHWORKS_TOKEN credentials", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-cli-mfa-system-profile-"))
  const configHome = join(directory, "config")
  const realmId = "01900000-0000-7000-8000-000000000001"
  const requests: RequestRecord[] = []
  const server = Bun.serve({
    async fetch(request) {
      const url = new URL(request.url)
      requests.push({
        authorization: request.headers.get("authorization") ?? undefined,
        body: await request.text(),
        pathname: url.pathname,
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
    }).connectionProfileSet("mfa-system", {
      realmId,
      server: server.url.toString(),
      token: "profile-token",
    })
    expect(profile.success).toBe(true)

    const baseEnvironment = {
      AUTHWORKS_REALM_ID: undefined,
      AUTHWORKS_SYSTEM_SECRET: undefined,
      AUTHWORKS_TOKEN: "environment-token-must-be-ignored",
      AUTHWORKS_URL: undefined,
      XDG_CONFIG_HOME: configHome,
    }
    const args = [
      "mfa",
      "policy",
      "set",
      "--profile",
      "mfa-system",
      "--mode",
      "required",
      "--totp-window",
      "1",
      "--max-attempts",
      "5",
      "--lockout-duration-ms",
      "60000",
    ]

    const profileOnly = await cliRunWithEnvironment(baseEnvironment, ...args)
    expect(profileOnly.exitCode).toBe(0)
    expect(requests.at(-1)).toEqual({
      authorization: undefined,
      body: '{"lockoutDurationMs":60000,"maxAttempts":5,"mode":"required","totpWindow":1}',
      pathname: `/system/realms/${realmId}/mfa-policy`,
    })

    const systemEnvironment = await cliRunWithEnvironment(
      { ...baseEnvironment, AUTHWORKS_SYSTEM_SECRET: "environment-system-secret" },
      ...args,
    )
    expect(systemEnvironment.exitCode).toBe(0)
    expect(requests.at(-1)?.authorization).toBe("Bearer environment-system-secret")

    const systemFlag = await cliRunWithEnvironment(
      { ...baseEnvironment, AUTHWORKS_SYSTEM_SECRET: "environment-system-secret" },
      ...args,
      "--system-token",
      "flag-system-token",
    )
    expect(systemFlag.exitCode).toBe(0)
    expect(requests.at(-1)?.authorization).toBe("Bearer flag-system-token")

    const explicitConnectionToken = await cliRunWithEnvironment(
      { ...baseEnvironment, AUTHWORKS_SYSTEM_SECRET: "environment-system-secret" },
      ...args,
      "--token",
      "explicit-connection-token",
    )
    expect(explicitConnectionToken.exitCode).toBe(0)
    expect(requests.at(-1)?.authorization).toBe("Bearer explicit-connection-token")
  } finally {
    server.stop(true)
    await rm(directory, { force: true, recursive: true })
  }
})

test("realm and organization system commands ignore profile and AUTHWORKS_TOKEN bearer tokens", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-cli-system-profile-"))
  const configHome = join(directory, "config")
  const realmId = "01900000-0000-7000-8000-000000000001"
  const organizationId = "01900000-0000-7000-8000-000000000002"
  const requests: RequestRecord[] = []
  const server = Bun.serve({
    async fetch(request) {
      const url = new URL(request.url)
      requests.push({
        authorization: request.headers.get("authorization") ?? undefined,
        body: await request.text(),
        pathname: url.pathname,
      })
      return Response.json({ error: { code: "platform.test", message: "test response", status: 500 } }, { status: 500 })
    },
    port: 0,
  })

  const systemCommands = [
    ["realms", "list"],
    ["realms", "create", "--domain", "system.example.com", "--name", "System realm"],
    ["realms", "bootstrap-admin"],
    ["organizations", "create", "--name", "System organization"],
    ["organizations", "list"],
    ["organizations", "get"],
    ["organizations", "update", "--name", "Renamed organization"],
    ["organizations", "lifecycle", "--status", "active"],
    ["organizations", "branding-set", "--branding", "{}"],
    ["organizations", "domain-claim", "--domain", "system.example.com"],
    ["organizations", "domain-list"],
    ["organizations", "domain-verify", "--domain", "system.example.com"],
    ["organizations", "login-policy-set", "--policy", "{}"],
    ["organizations", "roles"],
    ["organizations", "member-add", "--user-id", "user", "--roles", "member"],
    ["organizations", "member-list"],
    ["organizations", "member-update", "--membership-id", "membership", "--roles", "member"],
    ["organizations", "member-remove", "--membership-id", "membership"],
    ["organizations", "invitation-create", "--email", "user@example.com", "--roles", "member"],
    ["organizations", "invitation-list"],
    ["organizations", "invitation-revoke", "--invitation-id", "invitation"],
    ["organizations", "switch"],
  ]

  try {
    const profile = await connectionProfilesStoreCreate({
      environment: { XDG_CONFIG_HOME: configHome },
    }).connectionProfileSet("system", {
      organizationId,
      realmId,
      server: server.url.toString(),
      token: "profile-token",
    })
    expect(profile.success).toBe(true)

    const noSystemSecret = {
      AUTHWORKS_ORGANIZATION_ID: undefined,
      AUTHWORKS_REALM_ID: undefined,
      AUTHWORKS_SYSTEM_SECRET: undefined,
      AUTHWORKS_TOKEN: "environment-token-must-be-ignored",
      AUTHWORKS_URL: undefined,
      XDG_CONFIG_HOME: configHome,
    }
    for (const command of systemCommands) {
      const result = await cliRunWithEnvironment(noSystemSecret, ...command, "--profile", "system")
      expect(result.exitCode).not.toBe(0)
    }
    expect(requests.slice(0, systemCommands.length).map((request) => request.authorization)).toEqual(
      systemCommands.map(() => undefined),
    )

    const environmentSystemSecret = await cliRunWithEnvironment(
      { ...noSystemSecret, AUTHWORKS_SYSTEM_SECRET: "environment-system-secret" },
      "organizations",
      "roles",
      "--profile",
      "system",
    )
    expect(environmentSystemSecret.exitCode).not.toBe(0)
    expect(requests.at(-1)?.authorization).toBe("Bearer environment-system-secret")

    const explicitSystemToken = await cliRunWithEnvironment(
      { ...noSystemSecret, AUTHWORKS_SYSTEM_SECRET: "environment-system-secret" },
      "realms",
      "list",
      "--profile",
      "system",
      "--token",
      "flag-system-token",
    )
    expect(explicitSystemToken.exitCode).not.toBe(0)
    expect(requests.at(-1)?.authorization).toBe("Bearer flag-system-token")

    const invitationAccept = await cliRunWithEnvironment(
      { ...noSystemSecret, AUTHWORKS_TOKEN: undefined },
      "organizations",
      "invitation-accept",
      "--profile",
      "system",
      "--token",
      "invitation-payload-token",
      "--user-id",
      "user",
    )
    const invitationDecline = await cliRunWithEnvironment(
      { ...noSystemSecret, AUTHWORKS_TOKEN: undefined },
      "organizations",
      "invitation-decline",
      "--profile",
      "system",
      "--token",
      "invitation-payload-token",
      "--user-id",
      "user",
    )
    expect(invitationAccept.exitCode).not.toBe(0)
    expect(invitationDecline.exitCode).not.toBe(0)
    expect(requests.at(-2)?.authorization).toBe("Bearer profile-token")
    expect(requests.at(-1)?.authorization).toBe("Bearer profile-token")

    const invitationEnvironment = await cliRunWithEnvironment(
      { ...noSystemSecret, AUTHWORKS_TOKEN: "environment-token" },
      "organizations",
      "invitation-accept",
      "--profile",
      "system",
      "--token",
      "invitation-payload-token",
      "--user-id",
      "user",
    )
    expect(invitationEnvironment.exitCode).not.toBe(0)
    expect(requests.at(-1)?.authorization).toBe("Bearer environment-token")
  } finally {
    server.stop(true)
    await rm(directory, { force: true, recursive: true })
  }
}, 10_000)

test("integrated CLI writers redact profile, environment, and flag connection tokens from errors", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-cli-writer-redaction-"))
  const configHome = join(directory, "config")
  const realmId = "01900000-0000-7000-8000-000000000001"
  const commands = [
    ["passwords", "policy", "get"],
    ["sessions", "current"],
    ["external-identities", "start", "--provider-id", "provider"],
  ]
  const server = Bun.serve({
    async fetch(request) {
      const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? "missing-token"
      return Response.json(
        {
          error: {
            code: "platform.http",
            details: { connectionToken: token },
            message: `The request failed for ${token}.`,
            status: 500,
          },
        },
        { status: 500 },
      )
    },
    port: 0,
  })

  try {
    const profile = await connectionProfilesStoreCreate({
      environment: { XDG_CONFIG_HOME: configHome },
    }).connectionProfileSet("integrated", {
      realmId,
      server: server.url.toString(),
      token: "profile-connection-token",
    })
    expect(profile.success).toBe(true)

    const sources = [
      {
        environment: {
          AUTHWORKS_REALM_ID: undefined,
          AUTHWORKS_TOKEN: undefined,
          AUTHWORKS_URL: undefined,
          XDG_CONFIG_HOME: configHome,
        },
        expectedToken: "profile-connection-token",
        suffix: ["--profile", "integrated"],
      },
      {
        environment: {
          AUTHWORKS_REALM_ID: realmId,
          AUTHWORKS_TOKEN: "environment-connection-token",
          AUTHWORKS_URL: server.url.toString(),
          XDG_CONFIG_HOME: configHome,
        },
        expectedToken: "environment-connection-token",
        suffix: [],
      },
      {
        environment: {
          AUTHWORKS_REALM_ID: undefined,
          AUTHWORKS_TOKEN: undefined,
          AUTHWORKS_URL: undefined,
          XDG_CONFIG_HOME: configHome,
        },
        expectedToken: "flag-connection-token",
        suffix: ["--profile", "integrated", "--server", server.url.toString(), "--token", "flag-connection-token"],
      },
    ]

    for (const source of sources) {
      for (const command of commands) {
        const result = await cliRunWithEnvironment(source.environment, ...command, ...source.suffix)
        expect(result.exitCode).not.toBe(0)
        expect(result.stdout).not.toContain(source.expectedToken)
        expect(result.stderr).not.toContain(source.expectedToken)
        expect(result.stderr).toContain("[REDACTED]")
      }
    }
  } finally {
    server.stop(true)
    await rm(directory, { force: true, recursive: true })
  }
})

test("CLI redacts payload and connection tokens from echoed errors while preserving request payloads", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-cli-payload-token-"))
  const configHome = join(directory, "config")
  const realmId = "01900000-0000-7000-8000-000000000001"
  const payloadTokens = {
    organizationAccept: "organization-accept-payload-token-12345678901234567890",
    organizationDecline: "organization-decline-payload-token-12345678901234567890",
    passwordRecovery: "password-recovery-payload-token-12345678901234567890",
    passwordVerify: "password-verify-payload-token-12345678901234567890",
  }
  const commands = [
    {
      args: ["passwords", "verify", "--realm-id", realmId, "--token", payloadTokens.passwordVerify],
      body: `{"token":"${payloadTokens.passwordVerify}"}`,
      payloadToken: payloadTokens.passwordVerify,
      pathname: `/realms/${realmId}/password/verify-email`,
    },
    {
      args: [
        "passwords",
        "recover",
        "complete",
        "--realm-id",
        realmId,
        "--token",
        payloadTokens.passwordRecovery,
        "--new-password",
        "new-password",
      ],
      body: `{"newPassword":"new-password","token":"${payloadTokens.passwordRecovery}"}`,
      payloadToken: payloadTokens.passwordRecovery,
      pathname: `/realms/${realmId}/password/recovery/complete`,
    },
    {
      args: [
        "organizations",
        "invitationAccept",
        "--token",
        payloadTokens.organizationAccept,
        "--user-id",
        "accepting-user",
      ],
      body: `{"token":"${payloadTokens.organizationAccept}","userId":"accepting-user"}`,
      payloadToken: payloadTokens.organizationAccept,
      pathname: "/organizations/invitations/accept",
    },
    {
      args: [
        "organizations",
        "invitationDecline",
        "--token",
        payloadTokens.organizationDecline,
        "--user-id",
        "declining-user",
      ],
      body: `{"token":"${payloadTokens.organizationDecline}","userId":"declining-user"}`,
      payloadToken: payloadTokens.organizationDecline,
      pathname: "/organizations/invitations/decline",
    },
  ]
  const requests: RequestRecord[] = []
  const server = Bun.serve({
    async fetch(request) {
      const url = new URL(request.url)
      const body = await request.text()
      const payloadToken = (JSON.parse(body) as { token?: string }).token
      const connectionToken = request.headers.get("authorization")?.replace("Bearer ", "")
      requests.push({
        authorization: request.headers.get("authorization") ?? undefined,
        body,
        pathname: url.pathname,
      })
      return Response.json(
        {
          error: {
            code: "platform.unauthorized",
            details: { connectionToken, payloadToken },
            message: `Unauthorized for ${connectionToken} and ${payloadToken}`,
            status: 401,
          },
        },
        { status: 401 },
      )
    },
    port: 0,
  })

  try {
    const profile = await connectionProfilesStoreCreate({
      environment: { XDG_CONFIG_HOME: configHome },
    }).connectionProfileSet("regression", {
      realmId,
      server: server.url.toString(),
      token: "profile-token",
    })
    expect(profile.success).toBe(true)

    const profileEnvironment = {
      AUTHWORKS_REALM_ID: undefined,
      AUTHWORKS_TOKEN: undefined,
      AUTHWORKS_URL: undefined,
      XDG_CONFIG_HOME: configHome,
    }
    for (const command of commands) {
      const result = await cliRunWithEnvironment(profileEnvironment, ...command.args, "--profile", "regression")
      expect(result.exitCode).not.toBe(0)
      expect(result.stdout).not.toContain(command.payloadToken)
      expect(result.stderr).not.toContain(command.payloadToken)
      expect(result.stdout).not.toContain("profile-token")
      expect(result.stderr).not.toContain("profile-token")
      expect(result.stderr).toContain("[REDACTED]")
    }
    expect(requests).toEqual(
      commands.map((command) => ({
        authorization: "Bearer profile-token",
        body: command.body,
        pathname: command.pathname,
      })),
    )

    const environment = {
      AUTHWORKS_REALM_ID: realmId,
      AUTHWORKS_TOKEN: "environment-token",
      AUTHWORKS_URL: server.url.toString(),
      XDG_CONFIG_HOME: configHome,
    }
    for (const command of commands) {
      const result = await cliRunWithEnvironment(environment, ...command.args)
      expect(result.exitCode).not.toBe(0)
      expect(result.stdout).not.toContain(command.payloadToken)
      expect(result.stderr).not.toContain(command.payloadToken)
      expect(result.stdout).not.toContain("environment-token")
      expect(result.stderr).not.toContain("environment-token")
      expect(result.stderr).toContain("[REDACTED]")
    }
    expect(requests.slice(commands.length)).toEqual(
      commands.map((command) => ({
        authorization: "Bearer environment-token",
        body: command.body,
        pathname: command.pathname,
      })),
    )
  } finally {
    server.stop(true)
    await rm(directory, { force: true, recursive: true })
  }
})

test("users, passwords, and external identity system routes isolate system-secret sources", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-cli-system-secret-isolation-"))
  const configHome = join(directory, "config")
  const realmId = "01900000-0000-7000-8000-000000000001"
  const requests: RequestRecord[] = []
  const server = Bun.serve({
    async fetch(request) {
      const url = new URL(request.url)
      requests.push({
        authorization: request.headers.get("authorization") ?? undefined,
        body: await request.text(),
        pathname: url.pathname,
      })
      return Response.json({ error: { code: "platform.test", message: "test response", status: 500 } }, { status: 500 })
    },
    port: 0,
  })

  try {
    const profile = await connectionProfilesStoreCreate({
      environment: { XDG_CONFIG_HOME: configHome },
    }).connectionProfileSet("system-isolation", {
      realmId,
      server: server.url.toString(),
      token: "profile-token",
    })
    expect(profile.success).toBe(true)

    const environment = {
      AUTHWORKS_REALM_ID: undefined,
      AUTHWORKS_SYSTEM_SECRET: undefined,
      AUTHWORKS_TOKEN: "environment-token",
      AUTHWORKS_URL: undefined,
      XDG_CONFIG_HOME: configHome,
    }
    const systemCommands = [
      ["users", "list"],
      ["users", "delete", "--user-id", "user"],
      [
        "passwords",
        "policy",
        "set",
        "--mode",
        "required",
        "--totp-window",
        "1",
        "--max-attempts",
        "5",
        "--lockout-duration-ms",
        "60000",
      ],
      ["external-identities", "list"],
    ]

    for (const command of systemCommands) {
      const result = await cliRunWithEnvironment(environment, ...command, "--profile", "system-isolation")
      expect(result.exitCode).not.toBe(0)
      expect(requests.at(-1)?.authorization).toBeUndefined()
    }

    for (const command of systemCommands) {
      const result = await cliRunWithEnvironment(
        { ...environment, AUTHWORKS_SYSTEM_SECRET: "environment-system-secret" },
        ...command,
        "--profile",
        "system-isolation",
      )
      expect(result.exitCode).not.toBe(0)
      expect(requests.at(-1)?.authorization).toBe("Bearer environment-system-secret")
    }

    for (const command of systemCommands) {
      const result = await cliRunWithEnvironment(
        { ...environment, AUTHWORKS_SYSTEM_SECRET: "environment-system-secret" },
        ...command,
        "--profile",
        "system-isolation",
        "--system-token",
        "flag-system-token",
        "--token",
        "lower-priority-connection-token",
      )
      expect(result.exitCode).not.toBe(0)
      expect(requests.at(-1)?.authorization).toBe("Bearer flag-system-token")
    }

    for (const command of systemCommands) {
      const result = await cliRunWithEnvironment(
        { ...environment, AUTHWORKS_SYSTEM_SECRET: "environment-system-secret" },
        ...command,
        "--profile",
        "system-isolation",
        "--token",
        "explicit-connection-token",
      )
      expect(result.exitCode).not.toBe(0)
      expect(requests.at(-1)?.authorization).toBe("Bearer explicit-connection-token")
    }

    const ordinaryCommands = [
      ["passwords", "policy", "get"],
      ["external-identities", "start", "--provider-id", "provider"],
    ]
    for (const command of ordinaryCommands) {
      const result = await cliRunWithEnvironment(environment, ...command, "--profile", "system-isolation")
      expect(result.exitCode).not.toBe(0)
      expect(requests.at(-1)?.authorization).toBe("Bearer environment-token")
      expect(requests.at(-1)?.pathname).not.toContain("/system/")
    }
  } finally {
    server.stop(true)
    await rm(directory, { force: true, recursive: true })
  }
})

test("OIDC logout redacts echoed ID token hints and connection tokens from errors", async () => {
  const connectionToken = "oidc-logout-connection-token-12345678901234567890"
  const idTokenHint = "oidc-logout-id-token-hint-12345678901234567890"
  let requestUrl: URL | undefined
  const server = Bun.serve({
    fetch(request) {
      requestUrl = new URL(request.url)
      return Response.json(
        {
          error: {
            code: "platform.http",
            message: `Logout failed for ${connectionToken} and ${idTokenHint}.`,
            status: 500,
          },
        },
        { status: 500 },
      )
    },
    port: 0,
  })

  try {
    const result = await cliRun(
      "oidc",
      "logout",
      "--server",
      server.url.toString(),
      "--token",
      connectionToken,
      "--id-token-hint",
      idTokenHint,
    )
    expect(result.exitCode).not.toBe(0)
    expect(result.stdout).toBe("")
    expect(result.stdout).not.toContain(connectionToken)
    expect(result.stdout).not.toContain(idTokenHint)
    expect(result.stderr).not.toContain(connectionToken)
    expect(result.stderr).not.toContain(idTokenHint)
    expect(result.stderr).toContain("[REDACTED]")
    expect(requestUrl?.searchParams.get("id_token_hint")).toBe(idTokenHint)
  } finally {
    server.stop(true)
  }
})

test("OIDC signing-key create redacts resolved system and connection tokens from output and errors", async () => {
  const connectionToken = "oidc-signing-key-connection-token-12345678901234567890"
  const systemToken = "oidc-signing-key-system-token-12345678901234567890"
  const realmId = "01900000-0000-7000-8000-000000000001"
  const keyId = "01900000-0000-7000-8000-000000000002"
  let requestCount = 0
  const server = Bun.serve({
    fetch(request) {
      requestCount += 1
      expect(request.method).toBe("POST")
      expect(new URL(request.url).pathname).toBe(`/system/realms/${realmId}/oidc/signing-keys`)
      expect(request.headers.get("authorization")).toBe(`Bearer ${systemToken}`)
      if (requestCount === 1)
        return Response.json({
          signingKey: {
            algorithm: "RS256",
            createdAt: 1,
            id: keyId,
            realmId,
            publicJwk: {
              alg: "RS256",
              e: systemToken,
              kid: keyId,
              kty: "RSA",
              n: connectionToken,
              use: "sig",
            },
            retiredAt: null,
            status: "active",
          },
        })
      return Response.json(
        {
          error: {
            code: "platform.http",
            details: { connectionToken, systemToken },
            message: `Signing-key create failed for ${systemToken} and ${connectionToken}.`,
            status: 500,
          },
        },
        { status: 500 },
      )
    },
    port: 0,
  })

  try {
    const environment = {
      AUTHWORKS_REALM_ID: undefined,
      AUTHWORKS_SYSTEM_SECRET: systemToken,
      AUTHWORKS_TOKEN: connectionToken,
      AUTHWORKS_URL: undefined,
      XDG_CONFIG_HOME: undefined,
    }
    const command = ["oidc", "key-create", "--server", server.url.toString(), "--realm-id", realmId]

    const output = await cliRunWithEnvironment(environment, ...command)
    expect(output.exitCode).toBe(0)
    expect(output.stderr).toBe("")
    expect(output.stdout).not.toContain(systemToken)
    expect(output.stdout).not.toContain(connectionToken)
    expect(JSON.parse(output.stdout)).toEqual({
      signingKey: {
        algorithm: "RS256",
        createdAt: 1,
        id: keyId,
        publicJwk: { alg: "RS256", e: "[REDACTED]", kid: keyId, kty: "RSA", n: "[REDACTED]", use: "sig" },
        realmId,
        retiredAt: null,
        status: "active",
      },
    })

    const error = await cliRunWithEnvironment(environment, ...command)
    expect(error.exitCode).not.toBe(0)
    expect(error.stdout).toBe("")
    expect(error.stdout).not.toContain(systemToken)
    expect(error.stdout).not.toContain(connectionToken)
    expect(error.stderr).not.toContain(systemToken)
    expect(error.stderr).not.toContain(connectionToken)
    expect(error.stderr).toContain("[REDACTED]")
  } finally {
    server.stop(true)
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
