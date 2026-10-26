import * as v from "valibot"
import { listQuerySchema } from "../../platform/http/listQuerySchema.js"
import type { StorageDatabase } from "../../platform/storage/storageDatabaseOpen.js"
import { authorizationEnforce } from "../authorization/actions/authorizationEnforce.js"
import { authorizationPermissionDefinitions } from "../authorization/public/authorizationPermissionDefinitions.js"
import { eventList } from "../events/actions/eventList.js"
import { type EventListQuery, eventListQuerySchema } from "../events/public/eventListQuerySchema.js"
import { machineCredentialList } from "../machineUsers/actions/machineCredentialList.js"
import { machineUserGet } from "../machineUsers/actions/machineUserGet.js"
import { machineUserList } from "../machineUsers/actions/machineUserList.js"
import { oidcClientGet } from "../oidc/actions/oidcClientGet.js"
import { oidcClientList } from "../oidc/actions/oidcClientList.js"
import { oidcDiscoveryGet } from "../oidc/actions/oidcDiscoveryGet.js"
import { oidcJwksGet } from "../oidc/actions/oidcJwksGet.js"
import { oidcSigningKeyList } from "../oidc/actions/oidcSigningKeyList.js"
import { oidcClientIdSchema } from "../oidc/public/oidcClientIdSchema.js"
import { organizationBrandingGet } from "../organizations/actions/organizationBrandingGet.js"
import { organizationDomainList } from "../organizations/actions/organizationDomainList.js"
import { organizationGet } from "../organizations/actions/organizationGet.js"
import { organizationInvitationList } from "../organizations/actions/organizationInvitationList.js"
import { organizationList } from "../organizations/actions/organizationList.js"
import { organizationLoginPolicyGet } from "../organizations/actions/organizationLoginPolicyGet.js"
import { organizationMembershipList } from "../organizations/actions/organizationMembershipList.js"
import { organizationMetadataGet } from "../organizations/actions/organizationMetadataGet.js"
import { organizationMetadataList } from "../organizations/actions/organizationMetadataList.js"
import { organizationMetadataKeySchema } from "../organizations/public/organizationMetadataKeySchema.js"
import { organizationMetadataListQuerySchema } from "../organizations/public/organizationMetadataListQuerySchema.js"
import { organizationResourceIdSchema } from "../organizations/public/organizationResourceIdSchema.js"
import { projectApplicationList } from "../projects/actions/projectApplicationList.js"
import { projectGet } from "../projects/actions/projectGet.js"
import { projectGrantList } from "../projects/actions/projectGrantList.js"
import { projectList } from "../projects/actions/projectList.js"
import { projectRoleList } from "../projects/actions/projectRoleList.js"
import { projectUserAssignmentList } from "../projects/actions/projectUserAssignmentList.js"
import { projectListQuerySchema } from "../projects/public/projectListQuerySchema.js"
import { projectResourceIdSchema } from "../projects/public/projectResourceIdSchema.js"
import { realmGet } from "../realms/actions/realmGet.js"
import type { RealmTenantContext } from "../realms/server/index.js"
import { sessionAdministratorList } from "../sessions/actions/sessionAdministratorList.js"
import { userGet } from "../users/actions/userGet.js"
import { userList } from "../users/actions/userList.js"
import { userMetadataGet } from "../users/actions/userMetadataGet.js"
import { userMetadataList } from "../users/actions/userMetadataList.js"
import { userListQuerySchema } from "../users/public/userListQuerySchema.js"
import { userMetadataKeySchema } from "../users/public/userMetadataKeySchema.js"
import { userMetadataListQuerySchema } from "../users/public/userMetadataListQuerySchema.js"
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
      name: "organization-metadata-get",
      description: "Get an organization metadata entry by key. Inherits the credential permissions.",
      inputSchema: v.object({
        organizationId: organizationResourceIdSchema,
        key: organizationMetadataKeySchema,
      }),
      run: async (args) => {
        const result = organizationMetadataGet({
          context,
          database,
          key: args.key as string,
          organizationId: args.organizationId as string,
          realmId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "organization-metadata-list",
      description: "List organization metadata entries. Inherits the credential permissions.",
      inputSchema: v.object({
        organizationId: organizationResourceIdSchema,
        ...organizationMetadataListQuerySchema.entries,
      }),
      run: async (args) => {
        const { organizationId, ...query } = args as {
          organizationId: string
          [field: string]: unknown
        }
        const result = organizationMetadataList({
          context,
          database,
          organizationId,
          query: query as v.InferInput<typeof organizationMetadataListQuerySchema>,
          realmId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "user-metadata-get",
      description: "Get a user metadata entry by key. Inherits the credential permissions.",
      inputSchema: v.object({ userId: userResourceIdSchema, key: userMetadataKeySchema }),
      run: async (args) => {
        const result = userMetadataGet({
          context,
          database,
          key: args.key as string,
          realmId,
          userId: args.userId as string,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "user-metadata-list",
      description: "List user metadata entries. Inherits the credential permissions.",
      inputSchema: v.object({
        userId: userResourceIdSchema,
        ...userMetadataListQuerySchema.entries,
      }),
      run: async (args) => {
        const { userId, ...query } = args as {
          userId: string
          [field: string]: unknown
        }
        const result = userMetadataList({
          context,
          database,
          query: query as v.InferInput<typeof userMetadataListQuerySchema>,
          realmId,
          userId,
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
      inputSchema: eventListQuerySchema,
      run: async (args) => {
        const result = eventList({
          context,
          database,
          realmId,
          query: args as v.InferInput<typeof eventListQuerySchema> as EventListQuery,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "realm-get",
      description: "Get the current realm. Inherits the credential permissions.",
      inputSchema: v.object({}),
      run: async () => {
        const result = realmGet({ context, database, realmId })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "organization-login-policy-get",
      description: "Get an organization login policy by ID. Inherits the credential permissions.",
      inputSchema: v.object({ organizationId: organizationResourceIdSchema }),
      run: async (args) => {
        const result = organizationLoginPolicyGet({
          context,
          database,
          organizationId: args.organizationId as string,
          realmId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "organization-branding-get",
      description: "Get organization branding by ID. Inherits the credential permissions.",
      inputSchema: v.object({ organizationId: organizationResourceIdSchema }),
      run: async (args) => {
        const result = organizationBrandingGet({
          context,
          database,
          organizationId: args.organizationId as string,
          realmId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "organization-domain-list",
      description: "List organization domains. Inherits the credential permissions.",
      inputSchema: v.object({
        organizationId: organizationResourceIdSchema,
        ...listQuerySchema.entries,
      }),
      run: async (args) => {
        const { organizationId, ...query } = args as {
          organizationId: string
          [field: string]: unknown
        }
        const result = organizationDomainList({
          context,
          database,
          organizationId,
          query: query as v.InferInput<typeof listQuerySchema>,
          realmId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "organization-membership-list",
      description: "List organization memberships. Inherits the credential permissions.",
      inputSchema: v.object({
        organizationId: organizationResourceIdSchema,
        ...listQuerySchema.entries,
      }),
      run: async (args) => {
        const { organizationId, ...query } = args as {
          organizationId: string
          [field: string]: unknown
        }
        const result = organizationMembershipList({
          context,
          database,
          organizationId,
          query: query as v.InferInput<typeof listQuerySchema>,
          realmId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "organization-invitation-list",
      description: "List organization invitations. Inherits the credential permissions.",
      inputSchema: v.object({
        organizationId: organizationResourceIdSchema,
        ...listQuerySchema.entries,
      }),
      run: async (args) => {
        const { organizationId, ...query } = args as {
          organizationId: string
          [field: string]: unknown
        }
        const result = organizationInvitationList({
          context,
          database,
          organizationId,
          query: query as v.InferInput<typeof listQuerySchema>,
          realmId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "project-role-list",
      description: "List project roles. Inherits the credential permissions.",
      inputSchema: v.object({
        projectId: projectResourceIdSchema,
        ...listQuerySchema.entries,
      }),
      run: async (args) => {
        const { projectId, ...query } = args as {
          projectId: string
          [field: string]: unknown
        }
        const result = projectRoleList({
          context,
          database,
          projectId,
          query: query as v.InferInput<typeof listQuerySchema>,
          realmId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "project-grant-list",
      description: "List project grants. Inherits the credential permissions.",
      inputSchema: v.object({
        projectId: projectResourceIdSchema,
        ...listQuerySchema.entries,
      }),
      run: async (args) => {
        const { projectId, ...query } = args as {
          projectId: string
          [field: string]: unknown
        }
        const result = projectGrantList({
          context,
          database,
          projectId,
          query: query as v.InferInput<typeof listQuerySchema>,
          realmId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "project-user-assignment-list",
      description: "List project user assignments. Inherits the credential permissions.",
      inputSchema: v.object({
        projectId: projectResourceIdSchema,
        ...listQuerySchema.entries,
      }),
      run: async (args) => {
        const { projectId, ...query } = args as {
          projectId: string
          [field: string]: unknown
        }
        const result = projectUserAssignmentList({
          context,
          database,
          projectId,
          query: query as v.InferInput<typeof listQuerySchema>,
          realmId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "project-application-list",
      description: "List project applications. Inherits the credential permissions.",
      inputSchema: v.object({
        projectId: projectResourceIdSchema,
        ...listQuerySchema.entries,
      }),
      run: async (args) => {
        const { projectId, ...query } = args as {
          projectId: string
          [field: string]: unknown
        }
        const result = projectApplicationList({
          context,
          database,
          projectId,
          query: query as v.InferInput<typeof listQuerySchema>,
          realmId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "oidc-client-list",
      description: "List OIDC clients in the realm. Requires the oidc.read permission.",
      inputSchema: listQuerySchema,
      run: async (args) => {
        const authorized = authorizationEnforce({
          actor: context.actor,
          permission: authorizationPermissionDefinitions.oidcRead,
          realmId,
        })
        if (!authorized.success) return mcpToolResult(authorized, true)
        const result = oidcClientList({
          context,
          database,
          realmId,
          query: args as v.InferInput<typeof listQuerySchema>,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "oidc-client-get",
      description: "Get an OIDC client by ID. Requires the oidc.read permission. Never returns secret material.",
      inputSchema: v.object({ clientId: oidcClientIdSchema }),
      run: async (args) => {
        const authorized = authorizationEnforce({
          actor: context.actor,
          permission: authorizationPermissionDefinitions.oidcRead,
          realmId,
        })
        if (!authorized.success) return mcpToolResult(authorized, true)
        const result = oidcClientGet({
          clientId: args.clientId as string,
          context,
          database,
          realmId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "oidc-discovery-get",
      description: "Get the OIDC discovery document for the credential realm. Public protocol metadata.",
      inputSchema: v.object({}),
      run: async () => {
        const result = oidcDiscoveryGet({ database, realmId })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "oidc-jwks-get",
      description: "Get the OIDC JSON Web Key Set for the credential realm. Public protocol metadata.",
      inputSchema: v.object({}),
      run: async () => {
        const result = oidcJwksGet({ database, realmId })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "oidc-signing-key-list",
      description: "List OIDC signing keys in the realm. Requires the oidc.read permission.",
      inputSchema: listQuerySchema,
      run: async (args) => {
        const authorized = authorizationEnforce({
          actor: context.actor,
          permission: authorizationPermissionDefinitions.oidcRead,
          realmId,
        })
        if (!authorized.success) return mcpToolResult(authorized, true)
        const result = oidcSigningKeyList({
          context,
          database,
          realmId,
          query: args as v.InferInput<typeof listQuerySchema>,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "machine-credential-list",
      description: "List machine credentials for a machine user. Inherits the credential permissions.",
      inputSchema: v.object({
        organizationId: organizationResourceIdSchema,
        machineUserId: v.pipe(v.string(), v.minLength(1)),
        ...listQuerySchema.entries,
      }),
      run: async (args) => {
        const { organizationId, machineUserId, ...query } = args as {
          organizationId: string
          machineUserId: string
          [field: string]: unknown
        }
        const result = machineCredentialList({
          context,
          database,
          organizationId,
          realmId,
          machineUserId,
          query: query as v.InferInput<typeof listQuerySchema>,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "session-list",
      description:
        "List sessions for a user by ID. Uses the session administrator list; machine credentials are denied by that administrator gate.",
      inputSchema: v.object({
        userId: userResourceIdSchema,
        ...listQuerySchema.entries,
      }),
      run: async (args) => {
        const { userId, ...query } = args as {
          userId: string
          [field: string]: unknown
        }
        const result = sessionAdministratorList({
          actor: context.actor,
          database,
          query: query as v.InferInput<typeof listQuerySchema>,
          realmId,
          userId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
  ]
}
