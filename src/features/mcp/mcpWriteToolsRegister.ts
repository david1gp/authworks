import * as v from "valibot"
import type { StorageDatabase } from "../../platform/storage/storageDatabaseOpen.js"
import type { RealmTenantContext } from "../realms/server/index.js"
import { machineCredentialIssue } from "../machineUsers/actions/machineCredentialIssue.js"
import { machineCredentialRevoke } from "../machineUsers/actions/machineCredentialRevoke.js"
import { machineUserCreate } from "../machineUsers/actions/machineUserCreate.js"
import { machineUserLifecycleSet } from "../machineUsers/actions/machineUserLifecycleSet.js"
import { machineCredentialIssueRequestSchema } from "../machineUsers/public/machineCredentialIssueRequestSchema.js"
import { machineCredentialRevokeRequestSchema } from "../machineUsers/public/machineCredentialRevokeRequestSchema.js"
import { machineUserCreateRequestSchema } from "../machineUsers/public/machineUserCreateRequestSchema.js"
import { machineUserLifecycleRequestSchema } from "../machineUsers/public/machineUserLifecycleRequestSchema.js"
import { organizationCreate } from "../organizations/actions/organizationCreate.js"
import { organizationUpdate } from "../organizations/actions/organizationUpdate.js"
import { organizationCreateRequestSchema } from "../organizations/public/organizationCreateRequestSchema.js"
import { organizationResourceIdSchema } from "../organizations/public/organizationResourceIdSchema.js"
import { organizationUpdateRequestSchema } from "../organizations/public/organizationUpdateRequestSchema.js"
import { projectCreate } from "../projects/actions/projectCreate.js"
import { projectUpdate } from "../projects/actions/projectUpdate.js"
import { projectCreateRequestSchema } from "../projects/public/projectCreateRequestSchema.js"
import { projectResourceIdSchema } from "../projects/public/projectResourceIdSchema.js"
import { projectUpdateRequestSchema } from "../projects/public/projectUpdateRequestSchema.js"
import { userCreate } from "../users/actions/userCreate.js"
import { userLifecycleSet } from "../users/actions/userLifecycleSet.js"
import { userProfileUpdate } from "../users/actions/userProfileUpdate.js"
import { userCreateRequestSchema } from "../users/public/userCreateRequestSchema.js"
import { userLifecycleRequestSchema } from "../users/public/userLifecycleRequestSchema.js"
import { userProfileUpdateRequestSchema } from "../users/public/userProfileUpdateRequestSchema.js"
import { userResourceIdSchema } from "../users/public/userResourceIdSchema.js"
import type { McpToolDefinition } from "./mcpToolRegistry.js"
import { mcpToolResult } from "./mcpToolResult.js"

type McpWriteToolsRegisterOptions = {
  readonly context: RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
}

export function mcpWriteToolsRegister(options: McpWriteToolsRegisterOptions): McpToolDefinition[] {
  const { context, database, realmId } = options
  return [
    {
      name: "user-create",
      description: "Create a user in the realm. Inherits the credential permissions.",
      inputSchema: userCreateRequestSchema,
      run: async (args) => {
        const result = userCreate({
          context,
          database,
          input: args as v.InferInput<typeof userCreateRequestSchema>,
          realmId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "user-profile-update",
      description: "Update a user profile by ID. Inherits the credential permissions.",
      inputSchema: v.object({
        userId: userResourceIdSchema,
        ...userProfileUpdateRequestSchema.entries,
      }),
      run: async (args) => {
        const { userId, ...patch } = args as {
          userId: string
          [field: string]: unknown
        }
        const result = userProfileUpdate({
          context,
          database,
          input: patch as v.InferInput<typeof userProfileUpdateRequestSchema>,
          realmId,
          userId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "user-lifecycle-set",
      description: "Set a user lifecycle state by ID. Inherits the credential permissions.",
      inputSchema: v.object({
        userId: userResourceIdSchema,
        ...userLifecycleRequestSchema.entries,
      }),
      run: async (args) => {
        const { userId, ...lifecycle } = args as v.InferInput<typeof userLifecycleRequestSchema> & { userId: string }
        const result = userLifecycleSet({ context, database, input: lifecycle, realmId, userId })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "organization-create",
      description: "Create an organization in the realm. Inherits the credential permissions.",
      inputSchema: organizationCreateRequestSchema,
      run: async (args) => {
        const result = organizationCreate({
          context,
          database,
          input: args as v.InferInput<typeof organizationCreateRequestSchema>,
          realmId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "organization-update",
      description: "Update an organization by ID. Inherits the credential permissions.",
      inputSchema: v.object({
        organizationId: organizationResourceIdSchema,
        ...organizationUpdateRequestSchema.entries,
      }),
      run: async (args) => {
        const { organizationId, ...patch } = args as {
          organizationId: string
          [field: string]: unknown
        }
        const result = organizationUpdate({
          context,
          database,
          input: patch as v.InferInput<typeof organizationUpdateRequestSchema>,
          realmId,
          organizationId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "project-create",
      description: "Create a project in the realm. Inherits the credential permissions.",
      inputSchema: projectCreateRequestSchema,
      run: async (args) => {
        const result = projectCreate({
          context,
          database,
          input: args as v.InferInput<typeof projectCreateRequestSchema>,
          realmId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "project-update",
      description: "Update a project by ID. Inherits the credential permissions.",
      inputSchema: v.object({
        projectId: projectResourceIdSchema,
        ...projectUpdateRequestSchema.entries,
      }),
      run: async (args) => {
        const { projectId, ...patch } = args as {
          projectId: string
          [field: string]: unknown
        }
        const result = projectUpdate({
          context,
          database,
          input: patch as v.InferInput<typeof projectUpdateRequestSchema>,
          realmId,
          projectId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "machine-user-create",
      description:
        "Create a machine user in an organization. Returns the initial credential secret once. Inherits the credential permissions.",
      inputSchema: v.object({
        organizationId: organizationResourceIdSchema,
        ...machineUserCreateRequestSchema.entries,
      }),
      run: async (args) => {
        const { organizationId, ...input } = args as v.InferInput<typeof machineUserCreateRequestSchema> & {
          organizationId: string
        }
        const result = machineUserCreate({ context, database, input, organizationId, realmId })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "machine-user-lifecycle-set",
      description: "Set a machine user status by ID. Inherits the credential permissions.",
      inputSchema: v.object({
        organizationId: organizationResourceIdSchema,
        machineUserId: v.pipe(v.string(), v.minLength(1)),
        ...machineUserLifecycleRequestSchema.entries,
      }),
      run: async (args) => {
        const { organizationId, machineUserId, ...lifecycle } = args as v.InferInput<
          typeof machineUserLifecycleRequestSchema
        > & { organizationId: string; machineUserId: string }
        const result = machineUserLifecycleSet({
          context,
          database,
          input: lifecycle,
          organizationId,
          realmId,
          machineUserId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "machine-credential-issue",
      description:
        "Issue a machine credential for a machine user. Returns the secret once. Inherits the credential permissions.",
      inputSchema: v.object({
        organizationId: organizationResourceIdSchema,
        kind: v.picklist(["personal_access_token", "api_key"]),
        ...machineCredentialIssueRequestSchema.entries,
      }),
      run: async (args) => {
        const { organizationId, kind, ...input } = args as v.InferInput<typeof machineCredentialIssueRequestSchema> & {
          organizationId: string
          kind: "personal_access_token" | "api_key"
        }
        const result = machineCredentialIssue({
          context,
          database,
          input,
          organizationId,
          realmId,
          kind,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "machine-credential-revoke",
      description: "Revoke a machine credential by ID. Inherits the credential permissions.",
      inputSchema: v.object({
        organizationId: organizationResourceIdSchema,
        credentialId: v.pipe(v.string(), v.minLength(1)),
        ...machineCredentialRevokeRequestSchema.entries,
      }),
      run: async (args) => {
        const { organizationId, credentialId, ...input } = args as v.InferInput<
          typeof machineCredentialRevokeRequestSchema
        > & { organizationId: string; credentialId: string }
        const result = machineCredentialRevoke({
          context,
          credentialId,
          database,
          input,
          organizationId,
          realmId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
  ]
}
