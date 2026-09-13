import { expect, test } from "bun:test"
import { packageVersion } from "../../src/packageVersion.js"

type ProcessResult = {
  readonly exitCode: number
  readonly stderr: string
  readonly stdout: string
}

test("preserves plain version output", async () => {
  const result = await processRun(["bun", "src/outputs/cli.ts", "--version"])

  expect(result).toEqual({ exitCode: 0, stderr: "", stdout: `${packageVersion}\n` })
})

test("renders verbose metadata without starting a service", async () => {
  const result = await processRun(["bun", "src/outputs/cli.ts", "version", "--verbose"])

  expect(result.exitCode).toBe(0)
  expect(result.stderr).toBe("")
  expect(result.stdout).toContain(`${packageVersion}\n`)
  expect(result.stdout).toContain(`user agent: @adaptive-ds/authworks/${packageVersion}`)
  expect(result.stdout).toContain(
    "description: Backend-first identity platform: Hono server, typed API client library, and CLI. Users, orgs, OIDC, MFA, and events on SQLite.",
  )
  expect(result.stdout).toContain("author: David Siewert — https://david-siewert.com/")
  expect(result.stdout).toContain("license: MIT")
  expect(result.stdout).toContain("project: https://github.com/david1gp/authworks")
  expect(result.stdout).toContain("installation type: development checkout")
  expect(result.stdout).toContain("runtime requirements: node >=22, bun >=1.3.0")
  expect(result.stdout).toContain(`platform: ${process.platform} ${process.arch} (OS release `)
  expect(result.stdout).toMatch(/executable: .+\nexecutable target: .+\n/)
  expect(result.stdout).not.toContain("build details:")
})

async function processRun(args: readonly string[]): Promise<ProcessResult> {
  const child = Bun.spawn(Array.from(args), { stderr: "pipe", stdout: "pipe" })
  const [exitCode, stderr, stdout] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
    new Response(child.stdout).text(),
  ])
  return { exitCode, stderr, stdout }
}
