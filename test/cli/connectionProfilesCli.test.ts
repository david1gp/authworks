import { expect, test } from "bun:test"
import { mkdtemp, rm, stat } from "node:fs/promises"
import { join } from "node:path"

type CliRun = {
  readonly exitCode: number
  readonly stderr: string
  readonly stdout: string
}

test("profile command tree exposes focused help", async () => {
  const root = await cliRun("--help")
  expect(root.exitCode).toBe(0)
  expect(root.stdout).toContain("profile")

  const profile = await cliRun("profile", "--help")
  expect(profile.exitCode).toBe(0)
  expect(profile.stdout).toContain("set")
  expect(profile.stdout).toContain("list")
  expect(profile.stdout).toContain("show")
  expect(profile.stdout).toContain("delete")

  const set = await cliRun("profile", "set", "--help")
  expect(set.exitCode).toBe(0)
  expect(set.stdout).toContain("NAME")
  expect(set.stdout).toContain("--organization-id ORGANIZATION_ID")
  expect(set.stdout).toContain("--realm-id REALM_ID")
  expect(set.stdout).toContain("--server URL")
  expect(set.stdout).toContain("--token TOKEN")
})

test("profile set upserts omitted fields and list output is sorted and redacted", async () => {
  const directory = await mkdtemp(join("/tmp", "authworks-profile-cli-"))
  try {
    const first = await cliRunWithConfig(
      directory,
      "profile",
      "set",
      "zeta",
      "--server",
      "https://zeta.test",
      "--token",
      "zeta-secret",
      "--realm-id",
      "zeta-realm",
    )
    expect(first.exitCode).toBe(0)
    expect(first.stderr).toBe("")
    expect(JSON.parse(first.stdout)).toMatchObject({
      server: "https://zeta.test",
      token: "[REDACTED]",
      realmId: "zeta-realm",
    })

    const second = await cliRunWithConfig(directory, "profile", "set", "zeta", "--organization-id", "zeta-organization")
    expect(second.exitCode).toBe(0)

    const alpha = await cliRunWithConfig(
      directory,
      "profile",
      "set",
      "alpha",
      "--server",
      "https://alpha.test",
      "--token",
      "alpha-secret",
    )
    expect(alpha.exitCode).toBe(0)

    const show = await cliRunWithConfig(directory, "profile", "show", "zeta")
    expect(show.exitCode).toBe(0)
    expect(show.stdout).toContain("[REDACTED]")
    expect(show.stdout).not.toContain("zeta-secret")
    expect(JSON.parse(show.stdout)).toMatchObject({
      organizationId: "zeta-organization",
      realmId: "zeta-realm",
      server: "https://zeta.test",
    })

    const list = await cliRunWithConfig(directory, "profile", "list")
    expect(list.exitCode).toBe(0)
    expect(list.stdout).not.toContain("alpha-secret")
    expect(list.stdout).not.toContain("zeta-secret")
    expect(JSON.parse(list.stdout)).toEqual([
      { name: "alpha", server: "https://alpha.test", token: "[REDACTED]" },
      {
        name: "zeta",
        organizationId: "zeta-organization",
        realmId: "zeta-realm",
        server: "https://zeta.test",
        token: "[REDACTED]",
      },
    ])

    const deleted = await cliRunWithConfig(directory, "profile", "delete", "alpha")
    expect(deleted.exitCode).toBe(0)
    expect(JSON.parse(deleted.stdout)).toBe(true)
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

test("profile commands reject invalid names before filesystem access", async () => {
  const directory = await mkdtemp(join("/tmp", "authworks-profile-cli-"))
  const configHome = join(directory, "not-created")
  try {
    const result = await cliRunWithConfig(configHome, "profile", "set", "../secret", "--token", "profile-secret")
    expect(result.exitCode).not.toBe(0)
    expect(result.stdout).toBe("")
    expect(result.stderr).toContain("profile name")
    await expect(stat(join(configHome, "authworks"))).rejects.toMatchObject({ code: "ENOENT" })
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

test("profile show and delete report missing profiles", async () => {
  const directory = await mkdtemp(join("/tmp", "authworks-profile-cli-"))
  try {
    for (const command of ["show", "delete"] as const) {
      const result = await cliRunWithConfig(directory, "profile", command, "missing")
      expect(result.exitCode).not.toBe(0)
      expect(result.stdout).toBe("")
      expect(result.stderr).toBe('Connection profile "missing" was not found.\n')
    }
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

async function cliRun(...args: string[]): Promise<CliRun> {
  return cliRunWithEnvironment({}, ...args)
}

async function cliRunWithConfig(configHome: string, ...args: string[]): Promise<CliRun> {
  return cliRunWithEnvironment({ XDG_CONFIG_HOME: configHome }, ...args)
}

async function cliRunWithEnvironment(environmentOverrides: Record<string, string | undefined>, ...args: string[]) {
  const environment = { ...process.env }
  for (const [name, value] of Object.entries(environmentOverrides)) {
    if (value === undefined) delete environment[name]
    else environment[name] = value
  }

  const child = Bun.spawn(["bun", "src/outputs/cli.ts", ...args], {
    env: environment,
    stderr: "pipe",
    stdout: "pipe",
  })
  const [exitCode, stderr, stdout] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
    new Response(child.stdout).text(),
  ])
  return { exitCode, stderr, stdout }
}
