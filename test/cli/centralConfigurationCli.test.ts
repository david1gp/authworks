import { expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

type CliRun = {
  readonly exitCode: number
  readonly stderr: string
  readonly stdout: string
}

test("central CLI flags and local credential output are available without API authentication", async () => {
  const directory = await mkdirTemporaryDirectory()
  const configHome = join(directory, "config")
  const configDirectory = join(configHome, "authworks")
  await mkdir(join(configDirectory, "credentials"), { recursive: true })
  await mkdir(join(configDirectory, "projects"), { recursive: true })
  await writeFile(
    join(configDirectory, "config.json"),
    JSON.stringify({
      profiles: { local: { baseUrl: "http://127.0.0.1:1", organizationId: "organization", realmId: "realm" } },
    }),
  )
  await writeFile(
    join(configDirectory, "projects", "demo.json"),
    JSON.stringify({ profile: "local", projectId: "project" }),
  )
  await writeFile(
    join(configDirectory, "credentials", "local.json"),
    JSON.stringify({ testUsers: { admin: { password: "secret", userId: "user", username: "admin@example.com" } } }),
  )

  try {
    const help = await cliRunWithEnvironment({ XDG_CONFIG_HOME: configHome }, "credentials", "get", "--help")
    expect(help.exitCode).toBe(0)
    expect(help.stdout).toContain("ALIAS")
    expect(help.stdout).toContain("--profile NAME")
    expect(help.stdout).toContain("--project NAME")
    expect(help.stdout).toContain("--field username|password|userId")
    expect(help.stdout).toContain("--output json")

    const projectHelp = await cliRunWithEnvironment({ XDG_CONFIG_HOME: configHome }, "projects", "get", "--help")
    expect(projectHelp.exitCode).toBe(0)
    expect(projectHelp.stdout).toContain("--profile NAME")
    expect(projectHelp.stdout).toContain("--project NAME")
    expect(projectHelp.stdout).toContain("--env-file PATH")
    expect(projectHelp.stdout).toContain("--base-url URL")

    const username = await cliRunWithEnvironment(
      { XDG_CONFIG_HOME: configHome, AUTHWORKS_TOKEN: undefined },
      "credentials",
      "get",
      "admin",
      "--profile",
      "local",
      "--field",
      "username",
    )
    expect(username).toEqual({ exitCode: 0, stderr: "", stdout: "admin@example.com\n" })

    const password = await cliRunWithEnvironment(
      { XDG_CONFIG_HOME: configHome },
      "credentials",
      "get",
      "admin",
      "--profile",
      "local",
      "--field",
      "password",
    )
    expect(password).toEqual({ exitCode: 0, stderr: "", stdout: "secret\n" })

    const userId = await cliRunWithEnvironment(
      { XDG_CONFIG_HOME: configHome },
      "credentials",
      "get",
      "admin",
      "--profile",
      "local",
      "--field",
      "userId",
    )
    expect(userId).toEqual({ exitCode: 0, stderr: "", stdout: "user\n" })

    const project = await cliRunWithEnvironment(
      { XDG_CONFIG_HOME: configHome, AUTHWORKS_PROJECT: "demo", AUTHWORKS_TOKEN: undefined },
      "credentials",
      "get",
      "admin",
      "--output",
      "json",
    )
    expect(project.exitCode).toBe(0)
    expect(project.stderr).toBe("")
    expect(JSON.parse(project.stdout)).toEqual({ password: "secret", userId: "user", username: "admin@example.com" })
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

test("central project selection supplies project IDs and dotenv values to native project commands", async () => {
  const directory = await mkdirTemporaryDirectory()
  const configHome = join(directory, "config")
  const configDirectory = join(configHome, "authworks")
  const organizationId = "01900000-0000-7000-8000-000000000001"
  const projectId = "01900000-0000-7000-8000-000000000002"
  const realmId = "01900000-0000-7000-8000-000000000003"
  const requests: string[] = []
  const server = Bun.serve({
    fetch(request) {
      const url = new URL(request.url)
      requests.push(url.pathname)
      return Response.json({
        project: {
          authorizationRequired: false,
          createdAt: 1,
          id: projectId,
          name: "Central project",
          organizationId,
          projectAccessRequired: false,
          realmId,
          status: "active",
          updatedAt: 1,
        },
      })
    },
    port: 0,
  })

  await mkdir(join(configDirectory, "projects"), { recursive: true })
  await writeFile(
    join(configDirectory, "config.json"),
    JSON.stringify({ profiles: { local: { baseUrl: "http://127.0.0.1:1", organizationId, realmId } } }),
  )
  await writeFile(join(configDirectory, "projects", "demo.json"), JSON.stringify({ profile: "local", projectId }))
  const envFile = join(directory, ".env")
  await writeFile(envFile, `AUTHWORKS_PROJECT=demo\nAUTHWORKS_BASE_URL=${server.url}\nAUTHWORKS_REALM_ID=${realmId}\n`)

  try {
    const result = await cliRunWithEnvironment(
      { XDG_CONFIG_HOME: configHome, AUTHWORKS_PROJECT: undefined, AUTHWORKS_TOKEN: undefined },
      "projects",
      "get",
      "--env-file",
      envFile,
    )
    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe("")
    expect(JSON.parse(result.stdout)).toMatchObject({ project: { id: projectId } })
    expect(requests).toEqual([`/system/realms/${realmId}/projects/${projectId}`])

    const explicitProject = await cliRunWithEnvironment(
      { XDG_CONFIG_HOME: configHome, AUTHWORKS_PROJECT: "not-used", AUTHWORKS_TOKEN: undefined },
      "projects",
      "get",
      "--project",
      "demo",
      "--base-url",
      server.url.toString(),
    )
    expect(explicitProject.exitCode).toBe(0)
    expect(requests).toHaveLength(2)
  } finally {
    server.stop(true)
    await rm(directory, { force: true, recursive: true })
  }
})

async function mkdirTemporaryDirectory(): Promise<string> {
  const directory = join(tmpdir(), `authworks-central-cli-${crypto.randomUUID()}`)
  await mkdir(directory, { recursive: true })
  return directory
}

async function cliRunWithEnvironment(
  environmentOverrides: Record<string, string | undefined>,
  ...args: string[]
): Promise<CliRun> {
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
