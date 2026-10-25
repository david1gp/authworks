import * as v from "valibot"
import { listQuerySchema } from "../../platform/http/listQuerySchema.js"
import type { StorageDatabase } from "../../platform/storage/storageDatabaseOpen.js"
import type { RealmTenantContext } from "../realms/server/index.js"
import { eventList } from "../events/actions/eventList.js"
import { machineUserGet } from "../machineUsers/actions/machineUserGet.js"
import { machineUserList } from "../machineUsers/actions/machineUserList.js"
import { organizationGet } from "../organizations/actions/organizationGet.js"
import { organizationList } from "../organizations/actions/organizationList.js"
import { organizationResourceIdSchema } from "../organizations/public/organizationResourceIdSchema.js"
import { projectGet } from "../projects/actions/projectGet.js"
import { projectList } from "../projects/actions/projectList.js"
import { projectListQuerySchema } from "../projects/public/projectListQuerySchema.js"
import { projectResourceIdSchema } from "../projects/public/projectResourceIdSchema.js"
import { userGet } from "../users/actions/userGet.js"
import { userList } from "../users/actions/userList.js"
import { userListQuerySchema } from "../users/public/userListQuerySchema.js"
import { userResourceIdSchema } from "../users/public/userResourceIdSchema.js"
import type { McpToolDefinition } from "./mcpToolRegistry.js"
import { mcpToolResult } from "./mcpToolResult.js"

type McpReadToolsRegisterOptions = {
  readonly context: RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly scopes: readonly string[]
}

export function mcpReadToolsRegister(options: McpReadToolsRegisterOptions): McpToolDefinition[] {
  const { context, database, realmId, scopes } = options
  return [
    {
      name: "ping",
      description: "Check that the MCP server is reachable.",
      inputSchema: v.object({}),
      run: async () => mcpToolResult("pong", false),
    },
    {
      name: "server-info",
      description: "Get MCP server information for the authenticated machine credential.",
      inputSchema: v.object({}),
      run: async () =>
        mcpToolResult({ name: "authworks", realmId, actorId: context.actorId, scopes: [...scopes] }, false),
    },
    {
      name: "user-list",
      description: "List users in the realm. Inherits the credential permissions.",
      inputSchema: userListQuerySchema,
      run: async (args) => {
        const result = userList({
          context,
          database,
          realmId,
          query: args as v.InferInput<typeof userListQuerySchema>,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "user-get",
      description: "Get a user by ID. Inherits the credential permissions.",
      inputSchema: v.object({ userId: userResourceIdSchema }),
      run: async (args) => {
        const result = userGet({
          context,
          database,
          realmId,
          userId: args.userId as string,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "organization-list",
      description: "List organizations in the realm. Inherits the credential permissions.",
      inputSchema: listQuerySchema,
      run: async (args) => {
        const result = organizationList({
          context,
          database,
          realmId,
          query: args as v.InferInput<typeof listQuerySchema>,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "organization-get",
      description: "Get an organization by ID. Inherits the credential permissions.",
      inputSchema: v.object({ organizationId: organizationResourceIdSchema }),
      run: async (args) => {
        const result = organizationGet({
          context,
          database,
          realmId,
          organizationId: args.organizationId as string,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "project-list",
      description:
        "List projects in the realm, optionally scoped to an organization. Inherits the credential permissions.",
      inputSchema: projectListQuerySchema,
      run: async (args) => {
        const { organizationId, ...query } = args as v.InferInput<typeof projectListQuerySchema>
        const result = projectList({
          context,
          database,
          realmId,
          ...(organizationId === undefined ? {} : { organizationId }),
          query,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "project-get",
      description: "Get a project by ID. Inherits the credential permissions.",
      inputSchema: v.object({ projectId: projectResourceIdSchema }),
      run: async (args) => {
        const result = projectGet({
          context,
          database,
          realmId,
          projectId: args.projectId as string,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "machine-user-list",
      description: "List machine users in an organization. Inherits the credential permissions.",
      inputSchema: v.object({
        organizationId: organizationResourceIdSchema,
        ...listQuerySchema.entries,
      }),
      run: async (args) => {
        const { organizationId, ...query } = args as {
          organizationId: string
          pageSize?: number
          pageToken?: string
          search?: string
          sortBy?: string
          sortDirection?: "asc" | "desc"
        }
        const result = machineUserList({ context, database, organizationId, query, realmId })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "machine-user-get",
      description: "Get a machine user by ID. Inherits the credential permissions.",
      inputSchema: v.object({
        organizationId: organizationResourceIdSchema,
        machineUserId: v.pipe(v.string(), v.minLength(1)),
      }),
      run: async (args) => {
        const result = machineUserGet({
          context,
          database,
          organizationId: args.organizationId as string,
          realmId,
          machineUserId: args.machineUserId as string,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "event-list",
      description: "List realm events, newest first. Inherits the credential permissions.",
      inputSchema: listQuerySchema,
      run: async (args) => {
        const result = eventList({
          context,
          database,
          realmId,
          query: args as v.InferInput<typeof listQuerySchema>,
        })
        return mcpToolResult(result, !result.success)
      },
    },
  ]
}
