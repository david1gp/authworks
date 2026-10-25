import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { StorageDatabase } from "../../platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../platform/testkit/platformTestkitCreate.js"
import { machineApiKeyCreate } from "../machineUsers/actions/machineApiKeyCreate.js"
import { machineUserCreate } from "../machineUsers/actions/machineUserCreate.js"
import { organizationCreate } from "../organizations/actions/organizationCreate.js"
import { realmCreate } from "../realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../realms/domain/realmSystemContextCreate.js"
import { mcpHttpHandlerCreate } from "./mcpHttpHandler.js"

type McpSeed = {
  readonly database: StorageDatabase
  readonly handle: (request: Request) => Promise<Response>
  readonly realmId: string
  readonly secret: string
}

async function withSeededDatabase<T>(operation: (seed: McpSeed) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "authworks-mcp-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), testkit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) throw new Error(opened.errorMessage)
  try {
    const database = opened.data
    const system = realmSystemContextCreate()
    const realmCreated = realmCreate({
      context: system,
      database,
      input: { domain: "mcp.example.com", name: "mcp.example.com" },
    })
    expect(realmCreated.success).toBe(true)
    if (!realmCreated.success) throw new Error(realmCreated.errorMessage)
    const realmId = realmCreated.data.realm.id
    const organizationCreated = organizationCreate({ context: system, database, input: { name: "MCP" }, realmId })
    expect(organizationCreated.success).toBe(true)
    if (!organizationCreated.success) throw new Error(organizationCreated.errorMessage)
    const organizationId = organizationCreated.data.organization.id
    const machineUserCreated = machineUserCreate({
      context: system,
      database,
      input: { displayName: "MCP worker", userName: "mcp-worker" },
      organizationId,
      realmId,
    })
    expect(machineUserCreated.success).toBe(true)
    if (!machineUserCreated.success) throw new Error(machineUserCreated.errorMessage)
    const apiKeyCreated = machineApiKeyCreate({
      context: system,
      database,
      input: { machineUserId: machineUserCreated.data.machineUser.id, name: "mcp-test" },
      organizationId,
      realmId,
    })
    expect(apiKeyCreated.success).toBe(true)
    if (!apiKeyCreated.success) throw new Error(apiKeyCreated.errorMessage)
    const handle = mcpHttpHandlerCreate({ database })
    return await operation({ database, handle, realmId, secret: apiKeyCreated.data.secret })
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

function jsonRpc(method: string, params?: unknown) {
  return { jsonrpc: "2.0", id: 1, method, ...(params === undefined ? {} : { params }) }
}

function mcpPost(seed: McpSeed, token: string | undefined, body: unknown): Promise<Response> {
  return seed.handle(
    new Request(`https://example.test/mcp?realmId=${seed.realmId}`, {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify(body),
    }),
  )
}

function initializeBody() {
  return jsonRpc("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "test", version: "1" },
  })
}

test("rejects missing and invalid Bearer credentials with 401", async () => {
  await withSeededDatabase(async (seed) => {
    for (const token of [undefined, "not-a-valid-token"]) {
      const response = await mcpPost(seed, token, initializeBody())
      expect(response.status).toBe(401)
    }
  })
})

test("accepts a valid machine credential with initialize", async () => {
  await withSeededDatabase(async (seed) => {
    const response = await mcpPost(seed, seed.secret, initializeBody())
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("application/json")
    expect(response.headers.get("mcp-session-id")).toBeNull()
    expect(await response.json()).toMatchObject({ result: { serverInfo: { name: "authworks" } } })
  })
})

test("supports one read and one write tools/call round-trip", async () => {
  await withSeededDatabase(async (seed) => {
    const readResponse = await mcpPost(seed, seed.secret, jsonRpc("tools/call", { name: "user-list", arguments: {} }))
    expect(readResponse.status).toBe(200)
    expect((await readResponse.json()).result.isError).not.toBe(true)

    const writeResponse = await mcpPost(
      seed,
      seed.secret,
      jsonRpc("tools/call", {
        name: "user-create",
        arguments: {
          email: "mcp-user@example.com",
          profile: { displayName: "MCP user" },
          userName: "mcp-user",
        },
      }),
    )
    expect(writeResponse.status).toBe(200)
    expect((await writeResponse.json()).result.isError).not.toBe(true)
  })
})
