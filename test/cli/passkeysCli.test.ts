import { expect, test } from "bun:test"

type CliRun = {
  readonly exitCode: number
  readonly stderr: string
  readonly stdout: string
}

async function cliRun(...args: string[]): Promise<CliRun> {
  const child = Bun.spawn(["bun", "src/outputs/cli.ts", ...args], {
    env: { ...process.env },
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

test("passkey ceremony commands expose every client operation", async () => {
  const help = await cliRun("passkeys", "--help")
  expect(help.exitCode).toBe(0)
  for (const command of [
    "registration-start",
    "registration-complete",
    "authentication-start",
    "authentication-complete",
    "mfa-login-start",
    "mfa-login-complete",
    "mfa-start",
    "mfa-complete",
    "step-up-start",
    "step-up-complete",
  ]) {
    expect(help.stdout).toContain(command)
  }
  const registrationStartHelp = await cliRun("passkeys", "registration-start", "--help")
  expect(registrationStartHelp.exitCode).toBe(0)
  expect(registrationStartHelp.stdout).toContain("--realm-id REALM_ID")
  const mfaLoginStartHelp = await cliRun("passkeys", "mfa-login-start", "--help")
  expect(mfaLoginStartHelp.exitCode).toBe(0)
  expect(mfaLoginStartHelp.stdout).toContain("--challenge-token VALUE")
  const registrationCompleteHelp = await cliRun("passkeys", "registration-complete", "--help")
  expect(registrationCompleteHelp.exitCode).toBe(0)
  expect(registrationCompleteHelp.stdout).toContain("--response-file PATH")
  const authenticationStartHelp = await cliRun("passkeys", "authentication-start", "--help")
  expect(authenticationStartHelp.exitCode).toBe(0)
  expect(authenticationStartHelp.stdout).toContain("--organization-id")
}, 60_000)

test("passkey ceremony completion reports an unreadable response file", async () => {
  const result = await cliRun(
    "passkeys",
    "registration-complete",
    "--server",
    "https://identity.example.test",
    "--realm-id",
    "realm-1",
    "--response-file",
    "/nonexistent/passkey-response.json",
  )
  expect(result.exitCode).toBe(1)
  expect(result.stderr).toContain("could not be read")
}, 60_000)
