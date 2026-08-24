import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { serverApplicationCreate } from "../../src/compositions/serverApplicationCreate.js"
import { wahaConfigurationParse } from "../../src/features/waha/server/wahaConfigurationParse.js"

test("WAHA configuration stays disabled unless explicitly enabled", () => {
  expect(wahaConfigurationParse({ AUTHWORKS_WAHA_ENDPOINTS: "not-parsed" })).toEqual({ data: undefined, success: true })
})

test("WAHA configuration parses multiple server-only endpoints and defaults", () => {
  const result = wahaConfigurationParse({
    AUTHWORKS_WAHA_ENABLED: "true",
    AUTHWORKS_WAHA_ENDPOINTS: JSON.stringify([
      { apiKey: "secret-one", baseUrl: "https://waha-one.example.test/", id: "primary", session: "default" },
      { apiKey: "secret-two", baseUrl: "https://waha-two.example.test", id: "secondary", session: "otp" },
    ]),
  })

  expect(result).toEqual({
    data: {
      endpoints: [
        {
          client: { apiKey: "secret-one", baseUrl: "https://waha-one.example.test", session: "default" },
          id: "primary",
        },
        {
          client: { apiKey: "secret-two", baseUrl: "https://waha-two.example.test", session: "otp" },
          id: "secondary",
        },
      ],
      freshnessTtlMs: 90_000,
      refreshIntervalMs: 30_000,
    },
    success: true,
  })
})

test("WAHA configuration accepts explicit refresh and freshness values only when the TTL covers the interval", () => {
  const result = wahaConfigurationParse({
    AUTHWORKS_WAHA_ENABLED: "true",
    AUTHWORKS_WAHA_ENDPOINTS: JSON.stringify([{ baseUrl: "https://waha.example.test", id: "primary" }]),
    AUTHWORKS_WAHA_FRESHNESS_TTL_MS: "15000",
    AUTHWORKS_WAHA_REFRESH_INTERVAL_MS: "5000",
  })
  expect(result).toEqual({
    data: {
      endpoints: [{ client: { baseUrl: "https://waha.example.test" }, id: "primary" }],
      freshnessTtlMs: 15_000,
      refreshIntervalMs: 5_000,
    },
    success: true,
  })

  const stale = wahaConfigurationParse({
    AUTHWORKS_WAHA_ENABLED: "true",
    AUTHWORKS_WAHA_ENDPOINTS: JSON.stringify([{ baseUrl: "https://waha.example.test", id: "primary" }]),
    AUTHWORKS_WAHA_FRESHNESS_TTL_MS: "1000",
    AUTHWORKS_WAHA_REFRESH_INTERVAL_MS: "2000",
  })
  expect(stale.success).toBe(false)
})

test("WAHA configuration rejects duplicate IDs and unsafe URLs without exposing secrets", () => {
  const duplicate = wahaConfigurationParse({
    AUTHWORKS_WAHA_ENABLED: "1",
    AUTHWORKS_WAHA_ENDPOINTS: JSON.stringify([
      { apiKey: "do-not-leak", baseUrl: "https://one.example.test", id: "same" },
      { baseUrl: "https://two.example.test", id: "same" },
    ]),
  })
  expect(duplicate.success).toBe(false)
  if (duplicate.success) return
  expect(duplicate.errorMessage).not.toContain("do-not-leak")
  expect(String(duplicate.errorData ?? "")).not.toContain("do-not-leak")

  const invalid = wahaConfigurationParse({
    AUTHWORKS_WAHA_ENABLED: "yes",
    AUTHWORKS_WAHA_ENDPOINTS: JSON.stringify([
      { apiKey: "also-do-not-leak", baseUrl: "https://user:pass@example.test", id: "one" },
    ]),
    AUTHWORKS_WAHA_FRESHNESS_TTL_MS: "1000",
    AUTHWORKS_WAHA_REFRESH_INTERVAL_MS: "2000",
  })
  expect(invalid.success).toBe(false)
  if (invalid.success) return
  expect(invalid.errorMessage).not.toContain("also-do-not-leak")
  expect(String(invalid.errorData ?? "")).not.toContain("also-do-not-leak")
})

test("WAHA configuration reports malformed endpoint fields without using the empty-list error", () => {
  const malformed = [
    {
      input: { apiKey: "field-secret", baseUrl: 42, id: "primary" },
      field: "endpoint 1.baseUrl",
    },
    {
      input: { apiKey: "field-secret", baseUrl: "https://waha.example.test", id: "primary", timeoutMs: "fast" },
      field: "endpoint 1.timeoutMs",
    },
    {
      input: { apiKey: "field-secret", baseUrl: "https://waha.example.test" },
      field: "endpoint 1.id",
    },
    {
      input: { apiKey: "field-secret", baseUrl: "https://waha.example.test", id: "bad id" },
      field: "endpoint 1.id",
    },
  ]

  for (const candidate of malformed) {
    const result = wahaConfigurationParse({
      AUTHWORKS_WAHA_ENABLED: "true",
      AUTHWORKS_WAHA_ENDPOINTS: JSON.stringify([candidate.input]),
    })
    expect(result.success).toBe(false)
    if (result.success) continue
    expect(result.errorMessage).toContain(candidate.field)
    expect(result.errorMessage).not.toContain("at least one endpoint is required")
    expect(result.errorMessage).not.toContain("field-secret")
    expect(String(result.errorData ?? "")).not.toContain("field-secret")
  }
})

test("WAHA endpoint IDs remain explicit, unique, stable, and non-secret", () => {
  const result = wahaConfigurationParse({
    AUTHWORKS_WAHA_ENABLED: "true",
    AUTHWORKS_WAHA_ENDPOINTS: JSON.stringify([
      { apiKey: "do-not-leak", baseUrl: "https://waha.example.test", id: "primary-eu-1" },
    ]),
  })

  expect(result.success).toBe(true)
  if (!result.success) return
  expect(result.data?.endpoints[0]?.id).toBe("primary-eu-1")
})

test("server composition accepts parsed WAHA configuration without adding a public route", async () => {
  const parsed = wahaConfigurationParse({
    AUTHWORKS_WAHA_ENABLED: "true",
    AUTHWORKS_WAHA_ENDPOINTS: JSON.stringify([
      { apiKey: "server-only-secret", baseUrl: "https://waha.example.test", id: "primary" },
    ]),
    AUTHWORKS_WAHA_FRESHNESS_TTL_MS: "15000",
    AUTHWORKS_WAHA_REFRESH_INTERVAL_MS: "5000",
  })
  expect(parsed.success).toBe(true)
  if (!parsed.success) return

  const directory = await mkdtemp(join(tmpdir(), "authworks-waha-composition-"))
  try {
    const created = serverApplicationCreate({
      databasePath: join(directory, "authworks.sqlite"),
      systemSecret: "waha-registration-rate-limit-secret",
      wahaConfiguration: parsed.data,
    })
    expect(created.success).toBe(true)
    if (!created.success) return

    expect((await created.data.request("/health")).status).toBe(200)
    expect((await created.data.request("/waha/configuration")).status).toBe(404)
    created.data.stop()
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

test("server composition rejects enabled WhatsApp registration without a rate-limit secret", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-waha-missing-secret-"))
  try {
    const created = serverApplicationCreate({
      databasePath: join(directory, "authworks.sqlite"),
      wahaConfiguration: {
        endpoints: [{ client: { baseUrl: "https://waha.example.test" }, id: "primary" }],
        freshnessTtlMs: 90_000,
        refreshIntervalMs: 30_000,
      },
    })
    expect(created).toMatchObject({
      code: "platform.configuration-invalid",
      errorMessage: "WhatsApp registration rate limiting requires AUTHWORKS_SYSTEM_SECRET.",
      success: false,
    })
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

test("email-only server composition remains available without a WhatsApp rate-limit secret", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-email-only-composition-"))
  try {
    const created = serverApplicationCreate({ databasePath: join(directory, "authworks.sqlite") })
    expect(created.success).toBe(true)
    if (!created.success) return
    expect((await created.data.request("/health")).status).toBe(200)
    created.data.stop()
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

test("server output validates enabled WAHA configuration before startup", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-waha-server-output-"))
  try {
    const child = Bun.spawn(["bun", "src/outputs/server.ts"], {
      env: {
        AUTHWORKS_DATABASE_PATH: join(directory, "authworks.sqlite"),
        AUTHWORKS_WAHA_ENABLED: "true",
        AUTHWORKS_WAHA_ENDPOINTS: "not-json",
        HOME: process.env.HOME ?? "",
        PATH: process.env.PATH ?? "",
      },
      stderr: "pipe",
      stdout: "pipe",
    })
    const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()])
    expect(exitCode).toBe(1)
    expect(stderr).toContain("AUTHWORKS_WAHA_ENDPOINTS must be valid JSON")
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

test("server output rejects enabled WAHA registration without a rate-limit secret", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-waha-server-missing-secret-"))
  try {
    const child = Bun.spawn(["bun", "src/outputs/server.ts"], {
      env: {
        AUTHWORKS_DATABASE_PATH: join(directory, "authworks.sqlite"),
        AUTHWORKS_SYSTEM_SECRET: "",
        AUTHWORKS_WAHA_ENABLED: "true",
        AUTHWORKS_WAHA_ENDPOINTS: JSON.stringify([{ baseUrl: "https://waha.example.test", id: "primary" }]),
        HOME: process.env.HOME ?? "",
        PATH: process.env.PATH ?? "",
      },
      stderr: "pipe",
      stdout: "pipe",
    })
    const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()])
    expect(exitCode).toBe(1)
    expect(stderr).toContain("AUTHWORKS_SYSTEM_SECRET")
    expect(stderr).not.toContain("waha.example.test")
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})
