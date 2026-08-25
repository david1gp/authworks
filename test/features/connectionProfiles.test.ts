import { expect, test } from "bun:test"
import { chmod, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { connectionProfilesConfigPathResolve } from "../../src/features/connectionProfiles/config/connectionProfilesConfigPathResolve.js"
import { connectionProfileNameValidate } from "../../src/features/connectionProfiles/model/connectionProfileNameValidate.js"
import { connectionProfilesStoreCreate } from "../../src/features/connectionProfiles/persistence/connectionProfilesStoreCreate.js"

test("connection profile names are bounded and filesystem-safe", () => {
  expect(connectionProfileNameValidate("default").success).toBe(true)
  expect(connectionProfileNameValidate("a-").success).toBe(true)
  expect(connectionProfileNameValidate(`a${"b".repeat(63)}`).success).toBe(true)
  for (const name of ["", ".hidden", "-named", "a/../b", "a b", `a${"b".repeat(64)}`]) {
    expect(connectionProfileNameValidate(name).success).toBe(false)
  }
})

test("connection profile config paths use injectable XDG and home values", () => {
  expect(
    connectionProfilesConfigPathResolve({
      environment: { XDG_CONFIG_HOME: "/tmp/authworks-xdg" },
      homeDirectory: "/tmp/authworks-home",
    }),
  ).toBe("/tmp/authworks-xdg/authworks/profiles.json")
  expect(
    connectionProfilesConfigPathResolve({
      environment: {},
      homeDirectory: "/tmp/authworks-home",
    }),
  ).toBe("/tmp/authworks-home/.config/authworks/profiles.json")
})

test("connection profile store supports CRUD, partial profiles, and owner-only creation", async () => {
  const directory = `/tmp/authworks-connection-profiles-${crypto.randomUUID()}`
  const path = join(directory, "authworks", "profiles.json")
  const store = connectionProfilesStoreCreate({ path })

  try {
    expect(await store.connectionProfileList()).toEqual({ data: {}, success: true })
    expect(
      await store.connectionProfileSet("default", { server: "https://authworks.test", token: "token-one" }),
    ).toEqual({
      data: { server: "https://authworks.test", token: "token-one" },
      success: true,
    })
    expect(await store.connectionProfileSet("default", { realmId: "realm-one" })).toEqual({
      data: { realmId: "realm-one", server: "https://authworks.test", token: "token-one" },
      success: true,
    })
    expect(await store.connectionProfileGet("default")).toEqual({
      data: { realmId: "realm-one", server: "https://authworks.test", token: "token-one" },
      success: true,
    })
    expect(await store.connectionProfileList()).toEqual({
      data: { default: { realmId: "realm-one", server: "https://authworks.test", token: "token-one" } },
      success: true,
    })
    expect(await store.connectionProfileDelete("default")).toEqual({ data: true, success: true })
    expect(await store.connectionProfileGet("default")).toEqual({ data: undefined, success: true })
    expect((await stat(path)).mode & 0o777).toBe(0o600)
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({})
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

test("connection profile store rejects malformed files without exposing secrets", async () => {
  const directory = `/tmp/authworks-connection-profiles-${crypto.randomUUID()}`
  const path = join(directory, "profiles.json")
  await mkdir(directory, { recursive: true })
  const secret = "profile-file-secret"
  await writeFile(path, `{"default": {"token": "${secret}"`, { mode: 0o600 })

  try {
    const result = await connectionProfilesStoreCreate({ path }).connectionProfileGet("default")
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errorMessage).not.toContain(secret)
    expect(String(result.errorData ?? "")).not.toContain(secret)
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

test("connection profile store rejects invalid profile data and system secrets", async () => {
  const directory = `/tmp/authworks-connection-profiles-${crypto.randomUUID()}`
  const path = join(directory, "profiles.json")
  const secret = "system-secret-value"
  const store = connectionProfilesStoreCreate({ path })

  try {
    const result = await store.connectionProfileSet("default", {
      token: "profile-token",
      AUTHWORKS_SYSTEM_SECRET: secret,
    })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errorMessage).not.toContain("profile-token")
    expect(result.errorMessage).not.toContain(secret)
    expect(String(result.errorData ?? "")).not.toContain("profile-token")
    expect(String(result.errorData ?? "")).not.toContain(secret)
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

test("invalid profile names are rejected before filesystem access", async () => {
  const directory = `/tmp/authworks-connection-profiles-${crypto.randomUUID()}`
  const path = join(directory, "profiles.json")
  const store = connectionProfilesStoreCreate({ path })

  try {
    const result = await store.connectionProfileGet("../secret")
    expect(result.success).toBe(false)
    await expect(stat(directory)).rejects.toMatchObject({ code: "ENOENT" })
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

test("profile file permissions are reduced when an existing file is updated", async () => {
  const directory = `/tmp/authworks-connection-profiles-${crypto.randomUUID()}`
  const path = join(directory, "profiles.json")
  await mkdir(directory, { recursive: true })
  await writeFile(path, "{}\n", { mode: 0o644 })
  await chmod(path, 0o644)

  try {
    const result = await connectionProfilesStoreCreate({ path }).connectionProfileSet("default", { server: "local" })
    expect(result.success).toBe(true)
    expect((await stat(path)).mode & 0o777).toBe(0o600)
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})
