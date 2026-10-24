import { expect, test } from "bun:test"
import {
  e2eDevEnvironmentEnvFileParse,
  e2eDevEnvironmentEnvFileSerialize,
  e2eDevEnvironmentPasswordCreate,
} from "../../e2e/harness/e2eDevEnvironmentCredentials.js"
import { e2eSecretFileWrite } from "../../e2e/harness/e2eSecretFileWrite.js"
import { e2eServiceUserIdentityGet } from "../../e2e/harness/e2eServiceUserEnsure.js"
import { e2eServiceUserStdinPasswordParse } from "../../e2e/harness/e2eServiceUserStdinPasswordParse.js"

test("e2e service-user stdin passwords parse without logging the secret", () => {
  const parsed = e2eServiceUserStdinPasswordParse(JSON.stringify({ password: "correct horse battery staple 1234" }))
  expect(parsed.success).toBe(true)
  if (parsed.success) expect(parsed.data).toBe("correct horse battery staple 1234")
  expect(e2eServiceUserStdinPasswordParse("not json").success).toBe(false)
  expect(e2eServiceUserStdinPasswordParse(JSON.stringify({ password: "" })).success).toBe(false)
  expect(e2eServiceUserStdinPasswordParse(JSON.stringify({})).success).toBe(false)
})

test("e2e service-user identity stays stable", () => {
  const identity = e2eServiceUserIdentityGet()
  expect(identity.userName).toBe("authworks-e2e-service")
  expect(identity.email).toBe("authworks-e2e-service@contentoren.de")
})

test("e2e dev credentials round-trip through the env file", () => {
  const credentials = {
    memberPassword: "member-secret",
    servicePassword: "service-secret",
    systemSecret: "system-secret",
  }
  const parsed = e2eDevEnvironmentEnvFileParse(e2eDevEnvironmentEnvFileSerialize(credentials))
  expect(parsed.success).toBe(true)
  if (parsed.success) expect(parsed.data).toEqual(credentials)
  expect(e2eDevEnvironmentEnvFileParse("{not json").success).toBe(false)
  expect(e2eDevEnvironmentEnvFileParse(JSON.stringify({})).success).toBe(false)
})

test("e2e dev passwords use fresh random bytes", () => {
  const first = e2eDevEnvironmentPasswordCreate((length) => new Uint8Array(length).fill(7))
  const second = e2eDevEnvironmentPasswordCreate((length) => new Uint8Array(length).fill(8))
  expect(first.length).toBeGreaterThan(16)
  expect(first).not.toBe(second)
})

test("e2e secret files write with owner-only permissions", async () => {
  const directory = await e2eHarnessTestDirCreate()
  const path = `${directory}/secret`
  const written = e2eSecretFileWrite(path, "top-secret")
  expect(written.success).toBe(true)
  const stat = await Bun.file(path).stat()
  expect((stat.mode & 0o777).toString(8)).toBe("600")
  expect(await Bun.file(path).text()).toBe("top-secret\n")
  expect(e2eSecretFileWrite("", "x").success).toBe(false)
})

async function e2eHarnessTestDirCreate(): Promise<string> {
  const { mkdir } = await import("node:fs/promises")
  const directory = `${process.env.TMPDIR ?? "/tmp"}/authworks-e2e-credentials-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  await mkdir(directory, { recursive: true })
  return directory
}
