import { expect, test } from "bun:test"
import { chmod, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { connectionProfilesStoreCreate } from "../../src/features/connectionProfiles/persistence/connectionProfilesStoreCreate.js"
import {
  authworksConfigurationDirectoryPathResolve,
  authworksConfigurationLoad,
  authworksConfigurationResolve,
  authworksCredentialsLoad,
  authworksLocalCredentialLookup,
  authworksProjectLoad,
} from "../../src/features/centralConfiguration/public/index.js"

test("central configuration paths use XDG and home fallbacks", () => {
  expect(
    authworksConfigurationDirectoryPathResolve({
      environment: { XDG_CONFIG_HOME: "/tmp/authworks-xdg" },
      homeDirectory: "/tmp/authworks-home",
    }),
  ).toBe("/tmp/authworks-xdg/authworks")
  expect(
    authworksConfigurationDirectoryPathResolve({
      environment: {},
      homeDirectory: "/tmp/authworks-home",
    }),
  ).toBe("/tmp/authworks-home/.config/authworks")
})

test("central loaders parse the requested flat files and secure credentials", async () => {
  const directory = `/tmp/authworks-central-load-${crypto.randomUUID()}`
  const configDirectory = join(directory, "authworks")
  const credentialsDirectory = join(configDirectory, "credentials")
  const projectsDirectory = join(configDirectory, "projects")
  await mkdir(credentialsDirectory, { recursive: true })
  await mkdir(projectsDirectory, { recursive: true })
  await writeFile(
    join(configDirectory, "config.json"),
    JSON.stringify({
      defaultProfile: "local",
      profiles: { local: { baseUrl: "https://local.test", organizationId: "org-1" } },
    }),
  )
  const credentialsPath = join(credentialsDirectory, "local.json")
  await writeFile(
    credentialsPath,
    JSON.stringify({
      testUsers: { admin: { password: "password", userId: "user-1", username: "admin" } },
      token: "token-1",
    }),
    { mode: 0o644 },
  )
  await chmod(credentialsPath, 0o644)
  await writeFile(join(projectsDirectory, "demo.json"), JSON.stringify({ profile: "local", projectId: "project-1" }))

  try {
    expect(await authworksConfigurationLoad({ configDirectory })).toEqual({
      data: {
        defaultProfile: "local",
        profiles: { local: { baseUrl: "https://local.test", organizationId: "org-1" } },
      },
      success: true,
    })
    expect(await authworksProjectLoad("demo", { configDirectory })).toEqual({
      data: { profile: "local", projectId: "project-1" },
      success: true,
    })
    expect(await authworksCredentialsLoad("local", { configDirectory })).toEqual({
      data: { testUsers: { admin: { password: "password", userId: "user-1", username: "admin" } }, token: "token-1" },
      success: true,
    })
    expect((await stat(credentialsPath)).mode & 0o777).toBe(0o600)
    expect((await stat(credentialsDirectory)).mode & 0o777).toBe(0o700)
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

test("configuration resolution follows explicit, environment, dotenv, project, profile, and default precedence", async () => {
  const directory = `/tmp/authworks-central-resolve-${crypto.randomUUID()}`
  const configDirectory = join(directory, "authworks")
  const dotenvPath = join(directory, ".env")
  await mkdir(join(configDirectory, "credentials"), { recursive: true })
  await mkdir(join(configDirectory, "projects"), { recursive: true })
  await writeFile(
    join(configDirectory, "config.json"),
    JSON.stringify({
      defaultProfile: "default",
      profiles: {
        default: { baseUrl: "https://default.test", organizationId: "default-org", realmId: "default-realm" },
        project: { baseUrl: "https://project.test", organizationId: "project-org", realmId: "project-realm" },
        dotenv: { baseUrl: "https://profile.test", organizationId: "profile-org" },
      },
    }),
  )
  await writeFile(
    join(configDirectory, "projects", "demo.json"),
    JSON.stringify({ profile: "project", projectId: "project-file" }),
  )
  await writeFile(join(configDirectory, "credentials", "project.json"), JSON.stringify({ token: "profile-token" }))
  await writeFile(
    dotenvPath,
    [
      "AUTHWORKS_BASE_URL=https://dotenv.test",
      "AUTHWORKS_ORGANIZATION_ID=dotenv-org",
      "AUTHWORKS_REALM_ID=dotenv-realm",
      "AUTHWORKS_PROJECT_ID=dotenv-project",
      "AUTHWORKS_TOKEN=dotenv-token",
      "AUTHWORKS_PROFILE=dotenv",
    ].join("\n"),
  )

  try {
    expect(
      await authworksConfigurationResolve({
        configDirectory,
        dotenvPath,
        environment: { AUTHWORKS_BASE_URL: "https://environment.test", AUTHWORKS_PROJECT: "demo" },
      }),
    ).toEqual({
      data: {
        baseUrl: "https://environment.test",
        organizationId: "dotenv-org",
        profile: "dotenv",
        project: "demo",
        projectId: "dotenv-project",
        realmId: "dotenv-realm",
        token: "dotenv-token",
      },
      success: true,
    })

    expect(
      await authworksConfigurationResolve({
        configDirectory,
        dotenvPath,
        environment: { AUTHWORKS_PROJECT: "demo", AUTHWORKS_PROJECT_ID: "environment-project" },
      }),
    ).toMatchObject({ success: true, data: { projectId: "environment-project" } })

    expect(await authworksConfigurationResolve({ configDirectory, project: "demo" })).toEqual({
      data: {
        baseUrl: "https://project.test",
        organizationId: "project-org",
        profile: "project",
        project: "demo",
        projectId: "project-file",
        realmId: "project-realm",
        token: "profile-token",
      },
      success: true,
    })

    expect(
      await authworksConfigurationResolve({
        configDirectory,
        project: "demo",
        baseUrl: "https://explicit.test",
        organizationId: "explicit-org",
        projectId: "explicit-project",
        token: "explicit-token",
      }),
    ).toEqual({
      data: {
        baseUrl: "https://explicit.test",
        organizationId: "explicit-org",
        profile: "project",
        project: "demo",
        projectId: "explicit-project",
        realmId: "project-realm",
        token: "explicit-token",
      },
      success: true,
    })

    expect(await authworksConfigurationResolve({ configDirectory })).toEqual({
      data: {
        baseUrl: "https://default.test",
        organizationId: "default-org",
        profile: "default",
        realmId: "default-realm",
      },
      success: true,
    })
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

test("local test-user lookup selects a profile without requiring a token", async () => {
  const directory = `/tmp/authworks-central-credentials-${crypto.randomUUID()}`
  const configDirectory = join(directory, "authworks")
  await mkdir(join(configDirectory, "credentials"), { recursive: true })
  await writeFile(
    join(configDirectory, "config.json"),
    JSON.stringify({
      defaultProfile: "local",
      profiles: { local: { baseUrl: "https://local.test", organizationId: "org-1" } },
    }),
  )
  await writeFile(
    join(configDirectory, "credentials", "local.json"),
    JSON.stringify({ testUsers: { admin: { password: "password", userId: "user-1", username: "admin" } } }),
  )

  try {
    expect(await authworksLocalCredentialLookup({ alias: "admin", configDirectory })).toEqual({
      data: { password: "password", userId: "user-1", username: "admin" },
      success: true,
    })
    expect(await authworksLocalCredentialLookup("missing", { configDirectory })).toEqual({
      data: undefined,
      success: true,
    })

    await writeFile(
      join(configDirectory, "credentials", "standalone.json"),
      JSON.stringify({ testUsers: { admin: { password: "password", userId: "user-1", username: "admin" } } }),
    )
    expect(await authworksLocalCredentialLookup({ alias: "admin", profile: "standalone", configDirectory })).toEqual({
      data: { password: "password", userId: "user-1", username: "admin" },
      success: true,
    })
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

test("local test-user lookup applies dotenv profile and project precedence", async () => {
  const directory = `/tmp/authworks-central-credentials-layering-${crypto.randomUUID()}`
  const configDirectory = join(directory, "authworks")
  const credentialsDirectory = join(configDirectory, "credentials")
  const projectsDirectory = join(configDirectory, "projects")
  const dotenvPath = join(directory, ".env")
  const credentialCreate = (userId: string) =>
    JSON.stringify({ testUsers: { admin: { password: "password", userId, username: "admin" } } })
  await mkdir(credentialsDirectory, { recursive: true })
  await mkdir(projectsDirectory, { recursive: true })
  await writeFile(
    join(configDirectory, "config.json"),
    JSON.stringify({
      profiles: {
        dotenv: { baseUrl: "https://dotenv.test", organizationId: "organization" },
        explicit: { baseUrl: "https://explicit.test", organizationId: "organization" },
        project: { baseUrl: "https://project.test", organizationId: "organization" },
        process: { baseUrl: "https://process.test", organizationId: "organization" },
      },
    }),
  )
  await writeFile(join(configDirectory, "credentials", "dotenv.json"), credentialCreate("dotenv-user"))
  await writeFile(join(configDirectory, "credentials", "explicit.json"), credentialCreate("explicit-user"))
  await writeFile(join(configDirectory, "credentials", "project.json"), credentialCreate("project-user"))
  await writeFile(join(configDirectory, "credentials", "process.json"), credentialCreate("process-user"))
  await writeFile(join(projectsDirectory, "demo.json"), JSON.stringify({ profile: "project", projectId: "project-id" }))

  try {
    await writeFile(dotenvPath, "AUTHWORKS_PROFILE=dotenv\n")
    expect(
      await authworksLocalCredentialLookup({
        alias: "admin",
        configDirectory,
        envFile: dotenvPath,
        environment: { AUTHWORKS_PROJECT: "demo" },
      }),
    ).toEqual({ data: { password: "password", userId: "dotenv-user", username: "admin" }, success: true })

    await writeFile(dotenvPath, "AUTHWORKS_PROJECT=demo\n")
    expect(await authworksLocalCredentialLookup({ alias: "admin", configDirectory, envFile: dotenvPath })).toEqual({
      data: { password: "password", userId: "project-user", username: "admin" },
      success: true,
    })

    expect(
      await authworksLocalCredentialLookup({
        alias: "admin",
        configDirectory,
        envFile: dotenvPath,
        profile: "explicit",
        project: "demo",
      }),
    ).toEqual({ data: { password: "password", userId: "explicit-user", username: "admin" }, success: true })

    expect(
      await authworksLocalCredentialLookup({
        alias: "admin",
        configDirectory,
        envFile: dotenvPath,
        environment: { AUTHWORKS_PROFILE: "process", AUTHWORKS_PROJECT: "demo" },
      }),
    ).toEqual({ data: { password: "password", userId: "process-user", username: "admin" }, success: true })
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

test("central resolution keeps legacy profiles available when no central profile is present", async () => {
  const directory = `/tmp/authworks-central-legacy-${crypto.randomUUID()}`
  const configDirectory = join(directory, "authworks")
  const legacyPath = join(configDirectory, "profiles.json")
  await mkdir(configDirectory, { recursive: true })
  await writeFile(join(configDirectory, "config.json"), JSON.stringify({ profiles: {} }))
  await connectionProfilesStoreCreate({ path: legacyPath }).connectionProfileSet("legacy", {
    organizationId: "legacy-org",
    realmId: "legacy-realm",
    server: "https://legacy.test",
    token: "legacy-token",
  })

  try {
    expect(await authworksConfigurationResolve({ configDirectory, profile: "legacy" })).toEqual({
      data: {
        baseUrl: "https://legacy.test",
        organizationId: "legacy-org",
        profile: "legacy",
        realmId: "legacy-realm",
        token: "legacy-token",
      },
      success: true,
    })
    expect((await readFile(legacyPath, "utf8")).includes("legacy-token")).toBe(true)
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})
