import { expect, test } from "bun:test"
import { rm } from "node:fs/promises"
import { join } from "node:path"
import { connectionProfileCliConnectionResolve } from "../../src/features/connectionProfiles/cli/connectionProfileCliConnectionResolve.js"
import { connectionProfileCliProfileFlag } from "../../src/features/connectionProfiles/cli/connectionProfileCliProfileFlag.js"
import { connectionProfileCliSystemTokenResolve } from "../../src/features/connectionProfiles/cli/connectionProfileCliSystemTokenResolve.js"
import { connectionProfilesStoreCreate } from "../../src/features/connectionProfiles/persistence/connectionProfilesStoreCreate.js"

test("the reusable profile flag is optional and parses a profile name", () => {
  const flag = connectionProfileCliProfileFlag()
  expect(flag.optional).toBe(true)
  expect(flag.parse("production")).toBe("production")
})

test("system tokens resolve only from the explicit flag and system-secret environment", () => {
  expect(
    connectionProfileCliSystemTokenResolve("flag-system-token", {
      AUTHWORKS_SYSTEM_SECRET: "environment-system-secret",
      AUTHWORKS_TOKEN: "environment-token",
    }),
  ).toBe("flag-system-token")
  expect(
    connectionProfileCliSystemTokenResolve(undefined, {
      AUTHWORKS_SYSTEM_SECRET: "environment-system-secret",
      AUTHWORKS_TOKEN: "environment-token",
    }),
  ).toBe("environment-system-secret")
  expect(connectionProfileCliSystemTokenResolve(undefined, { AUTHWORKS_TOKEN: "environment-token" })).toBeUndefined()
})

test("connection values resolve independently through profile, environment, and flags", async () => {
  const path = join(`/tmp/authworks-connection-profile-resolve-${crypto.randomUUID()}`, "profiles.json")
  const store = connectionProfilesStoreCreate({ path })
  await store.connectionProfileSet("default", {
    organizationId: "profile-organization",
    realmId: "profile-realm",
    server: "https://profile.test",
    token: "profile-token",
  })

  try {
    const profile = await connectionProfileCliConnectionResolve({}, { path })
    expect(profile).toEqual({
      data: {
        organizationId: "profile-organization",
        realmId: "profile-realm",
        server: "https://profile.test",
        token: "profile-token",
      },
      success: true,
    })

    const environment = await connectionProfileCliConnectionResolve(
      {},
      {
        environment: {
          AUTHWORKS_ORGANIZATION_ID: "environment-organization",
          AUTHWORKS_REALM_ID: "environment-realm",
          AUTHWORKS_TOKEN: "environment-token",
          AUTHWORKS_URL: "https://environment.test",
        },
        path,
      },
    )
    expect(environment).toEqual({
      data: {
        organizationId: "environment-organization",
        realmId: "environment-realm",
        server: "https://environment.test",
        token: "environment-token",
      },
      success: true,
    })

    const flags = await connectionProfileCliConnectionResolve(
      {
        organizationId: "flag-organization",
        profile: "default",
        realmId: "flag-realm",
        server: "https://flag.test",
        token: "flag-token",
      },
      {
        environment: {
          AUTHWORKS_ORGANIZATION_ID: "environment-organization",
          AUTHWORKS_REALM_ID: "environment-realm",
          AUTHWORKS_TOKEN: "environment-token",
          AUTHWORKS_URL: "https://environment.test",
        },
        path,
      },
    )
    expect(flags).toEqual({
      data: {
        organizationId: "flag-organization",
        realmId: "flag-realm",
        server: "https://flag.test",
        token: "flag-token",
      },
      success: true,
    })
  } finally {
    await rm(path, { force: true })
    await rm(path.replace(/\/[^/]+$/, ""), { force: true, recursive: true })
  }
})

test("mixed connection sources resolve each field independently for selected and implicit profiles", async () => {
  const directory = `/tmp/authworks-connection-profile-resolve-${crypto.randomUUID()}`
  const path = join(directory, "profiles.json")
  const store = connectionProfilesStoreCreate({ path })
  await store.connectionProfileSet("default", { organizationId: "implicit-default-organization" })
  await store.connectionProfileSet("staging", {
    organizationId: "selected-profile-organization",
    realmId: "selected-profile-realm",
    server: "https://selected-profile.test",
    token: "selected-profile-token",
  })

  try {
    const selected = await connectionProfileCliConnectionResolve(
      { profile: "staging", server: "https://flag.test" },
      {
        environment: {
          AUTHWORKS_TOKEN: "environment-token",
          AUTHWORKS_URL: "https://environment.test",
        },
        path,
      },
    )
    expect(selected).toEqual({
      data: {
        organizationId: "selected-profile-organization",
        realmId: "selected-profile-realm",
        server: "https://flag.test",
        token: "environment-token",
      },
      success: true,
    })

    const implicit = await connectionProfileCliConnectionResolve(
      { server: "https://implicit-flag.test" },
      {
        environment: {
          AUTHWORKS_REALM_ID: "environment-realm",
          AUTHWORKS_TOKEN: "implicit-environment-token",
          AUTHWORKS_URL: "https://implicit-environment.test",
        },
        path,
      },
    )
    expect(implicit).toEqual({
      data: {
        organizationId: "implicit-default-organization",
        realmId: "environment-realm",
        server: "https://implicit-flag.test",
        token: "implicit-environment-token",
      },
      success: true,
    })
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

test("an explicitly selected profile is used and a missing selection is an error", async () => {
  const directory = `/tmp/authworks-connection-profile-resolve-${crypto.randomUUID()}`
  const path = join(directory, "profiles.json")
  const store = connectionProfilesStoreCreate({ path })
  await store.connectionProfileSet("staging", { server: "https://staging.test", token: "staging-token" })

  try {
    const selected = await connectionProfileCliConnectionResolve({ profile: "staging" }, { path })
    expect(selected).toEqual({
      data: { server: "https://staging.test", token: "staging-token" },
      success: true,
    })

    const missing = await connectionProfileCliConnectionResolve({ profile: "missing" }, { path })
    expect(missing).toEqual({
      errorMessage: 'Connection profile "missing" was not found.',
      op: "connectionProfileCliConnectionResolve",
      success: false,
    })
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

test("environment-only and default server resolution remain backward compatible", async () => {
  const directory = `/tmp/authworks-connection-profile-resolve-${crypto.randomUUID()}`
  const path = join(directory, "profiles.json")

  try {
    const environment = await connectionProfileCliConnectionResolve(
      {},
      {
        environment: {
          AUTHWORKS_REALM_ID: "environment-realm",
          AUTHWORKS_TOKEN: "environment-token",
          AUTHWORKS_URL: "https://environment.test",
        },
        path,
      },
    )
    expect(environment).toEqual({
      data: {
        realmId: "environment-realm",
        server: "https://environment.test",
        token: "environment-token",
      },
      success: true,
    })

    const defaults = await connectionProfileCliConnectionResolve({}, { environment: {}, path })
    expect(defaults).toEqual({ data: { server: "http://127.0.0.1:3000" }, success: true })
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})
