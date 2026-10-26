import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import type { StorageDatabase } from "../../platform/storage/storageDatabaseOpen.js"
import { machineCredentialAuthenticate } from "../machineUsers/actions/machineCredentialAuthenticate.js"
import type { MachineCredentialAuthentication } from "../machineUsers/domain/machineCredentialAuthentication.js"
import { realmTenantContextResolve } from "../realms/actions/realmTenantContextResolve.js"
import type { RealmTenantContext } from "../realms/domain/realmTenantContext.js"
import { mcpReadToolsRegister } from "./mcpReadToolsRegister.js"
import type { McpToolDefinition } from "./mcpToolRegistry.js"
import { mcpToolRegistryCreate } from "./mcpToolRegistry.js"
import { mcpWriteToolsRegister } from "./mcpWriteToolsRegister.js"

type McpHttpHandlerCreateOptions = {
  readonly database: StorageDatabase
}

export function mcpHttpHandlerCreate(options: McpHttpHandlerCreateOptions): (request: Request) => Promise<Response> {
  return (request) => mcpHttpHandle(options.database, request)
}

async function mcpHttpHandle(database: StorageDatabase, request: Request): Promise<Response> {
  const realmId = mcpRealmIdResolve(database, request)
  if (realmId === null) return mcpUnauthorizedResponse()
  const authenticated = machineCredentialAuthenticate({
    database,
    realmId,
    token: mcpTokenGet(request.headers.get("authorization"), request.headers.get("x-api-key")),
  })
  if (!authenticated.success) return mcpUnauthorizedResponse()
  const server = mcpServerCreate(database, realmId, authenticated.data)
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
    sessionIdGenerator: undefined,
  })
  await server.connect(transport)
  return transport.handleRequest(request)
}

function mcpRealmIdResolve(database: StorageDatabase, request: Request): string | null {
  const url = new URL(request.url)
  const queryRealmId = url.searchParams.get("realmId")?.trim()
  if (queryRealmId !== undefined && queryRealmId !== null && queryRealmId.length > 0) return queryRealmId
  const tenant = realmTenantContextResolve({ database, host: mcpHostGet(request.headers.get("host"), url) })
  if (!tenant.success) return null
  return tenant.data.realmId
}

function mcpHostGet(host: string | null, url: URL): string {
  const resolvedHost = host ?? url.hostname
  return resolvedHost.startsWith("[")
    ? resolvedHost.slice(1, resolvedHost.indexOf("]"))
    : (resolvedHost.split(":")[0] ?? "")
}

function mcpTokenGet(authorization: string | null, apiKey: string | null): string {
  if (apiKey !== null && apiKey.length > 0) return apiKey
  if (authorization === null) return ""
  const match = /^Bearer\s+(\S+)$/i.exec(authorization)
  return match?.[1] ?? ""
}

function mcpServerCreate(
  database: StorageDatabase,
  realmId: string,
  authenticated: MachineCredentialAuthentication,
): Server {
  const context: RealmTenantContext = {
    actor: authenticated.actor,
    actorId: authenticated.actor.actorId,
    kind: "tenant",
    realmId,
  }
  const definitions: McpToolDefinition[] = [
    ...mcpReadToolsRegister({ context, database, realmId, scopes: authenticated.scopes }),
    ...mcpWriteToolsRegister({ context, database, realmId, scopes: authenticated.scopes }),
  ]
  const registry = mcpToolRegistryCreate(definitions)
  const server = new Server({ name: "authworks", version: "0.3.0" }, { capabilities: { tools: {} } })
  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: registry.registrations.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: { type: "object" as const, ...tool.inputJsonSchema },
      execution: { taskSupport: "forbidden" as const },
    })),
  }))
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const params = request.params as { name: string; arguments?: unknown }
    return registry.call(params.name, params.arguments)
  })
  return server
}

function mcpUnauthorizedResponse(): Response {
  return Response.json(
    {
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message: "Unauthorized",
        data: { code: "mcp.unauthorized", status: 401, retryable: false },
      },
      id: null,
    },
    { status: 401 },
  )
}
