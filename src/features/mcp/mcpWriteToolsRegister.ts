import * as v from "valibot"
import type { StorageDatabase } from "../../platform/storage/storageDatabaseOpen.js"
import { machineCredentialIssue } from "../machineUsers/actions/machineCredentialIssue.js"
import { machineCredentialRevoke } from "../machineUsers/actions/machineCredentialRevoke.js"
import { machineUserCreate } from "../machineUsers/actions/machineUserCreate.js"
import { machineUserLifecycleSet } from "../machineUsers/actions/machineUserLifecycleSet.js"
import { machineCredentialIssueRequestSchema } from "../machineUsers/public/machineCredentialIssueRequestSchema.js"
import { machineCredentialRevokeRequestSchema } from "../machineUsers/public/machineCredentialRevokeRequestSchema.js"
import { machineUserCreateRequestSchema } from "../machineUsers/public/machineUserCreateRequestSchema.js"
import { machineUserLifecycleRequestSchema } from "../machineUsers/public/machineUserLifecycleRequestSchema.js"
import { organizationBrandingSet } from "../organizations/actions/organizationBrandingSet.js"
import { organizationCreate } from "../organizations/actions/organizationCreate.js"
import { organizationDomainClaim } from "../organizations/actions/organizationDomainClaim.js"
import { organizationDomainRemove } from "../organizations/actions/organizationDomainRemove.js"
import { organizationDomainVerify } from "../organizations/actions/organizationDomainVerify.js"
import { organizationInvitationRevoke } from "../organizations/actions/organizationInvitationRevoke.js"
import { organizationLifecycleSet } from "../organizations/actions/organizationLifecycleSet.js"
import { organizationLoginPolicySet } from "../organizations/actions/organizationLoginPolicySet.js"
import { organizationMembershipCreate } from "../organizations/actions/organizationMembershipCreate.js"
import { organizationMembershipRemove } from "../organizations/actions/organizationMembershipRemove.js"
import { organizationMembershipUpdate } from "../organizations/actions/organizationMembershipUpdate.js"
import { organizationMetadataRemove } from "../organizations/actions/organizationMetadataRemove.js"
import { organizationMetadataSet } from "../organizations/actions/organizationMetadataSet.js"
import { organizationUpdate } from "../organizations/actions/organizationUpdate.js"
import { organizationDomainDnsVerificationPortCreate } from "../organizations/domain/organizationDomainDnsVerificationPortCreate.js"
import { organizationBrandingSetRequestSchema } from "../organizations/public/organizationBrandingSetRequestSchema.js"
import { organizationCreateRequestSchema } from "../organizations/public/organizationCreateRequestSchema.js"
import { organizationDomainClaimRequestSchema } from "../organizations/public/organizationDomainClaimRequestSchema.js"
import { organizationLifecycleRequestSchema } from "../organizations/public/organizationLifecycleRequestSchema.js"
import { organizationLoginPolicySetRequestSchema } from "../organizations/public/organizationLoginPolicySetRequestSchema.js"
import { organizationMembershipCreateRequestSchema } from "../organizations/public/organizationMembershipCreateRequestSchema.js"
import { organizationMembershipResourceIdSchema } from "../organizations/public/organizationMembershipResourceIdSchema.js"
import { organizationMembershipUpdateRequestSchema } from "../organizations/public/organizationMembershipUpdateRequestSchema.js"
import { organizationMetadataKeySchema } from "../organizations/public/organizationMetadataKeySchema.js"
import { organizationMetadataSetRequestSchema } from "../organizations/public/organizationMetadataSetRequestSchema.js"
import { organizationResourceIdSchema } from "../organizations/public/organizationResourceIdSchema.js"
import { organizationUpdateRequestSchema } from "../organizations/public/organizationUpdateRequestSchema.js"
import { projectApplicationCreate } from "../projects/actions/projectApplicationCreate.js"
import { projectApplicationDelete } from "../projects/actions/projectApplicationDelete.js"
import { projectApplicationUpdate } from "../projects/actions/projectApplicationUpdate.js"
import { projectCreate } from "../projects/actions/projectCreate.js"
import { projectGrantCreate } from "../projects/actions/projectGrantCreate.js"
import { projectGrantDelete } from "../projects/actions/projectGrantDelete.js"
import { projectGrantLifecycleSet } from "../projects/actions/projectGrantLifecycleSet.js"
import { projectGrantUpdate } from "../projects/actions/projectGrantUpdate.js"
import { projectRoleCreate } from "../projects/actions/projectRoleCreate.js"
import { projectRoleDelete } from "../projects/actions/projectRoleDelete.js"
import { projectRoleUpdate } from "../projects/actions/projectRoleUpdate.js"
import { projectUpdate } from "../projects/actions/projectUpdate.js"
import { projectUserAssignmentCreate } from "../projects/actions/projectUserAssignmentCreate.js"
import { projectUserAssignmentRemove } from "../projects/actions/projectUserAssignmentRemove.js"
import { projectApplicationCreateRequestSchema } from "../projects/public/projectApplicationCreateRequestSchema.js"
import { projectApplicationUpdateRequestSchema } from "../projects/public/projectApplicationUpdateRequestSchema.js"
import { projectCreateRequestSchema } from "../projects/public/projectCreateRequestSchema.js"
import { projectGrantCreateRequestSchema } from "../projects/public/projectGrantCreateRequestSchema.js"
import { projectGrantLifecycleRequestSchema } from "../projects/public/projectGrantLifecycleRequestSchema.js"
import { projectGrantUpdateRequestSchema } from "../projects/public/projectGrantUpdateRequestSchema.js"
import { projectResourceIdSchema } from "../projects/public/projectResourceIdSchema.js"
import { projectRoleCreateRequestSchema } from "../projects/public/projectRoleCreateRequestSchema.js"
import { projectRoleUpdateRequestSchema } from "../projects/public/projectRoleUpdateRequestSchema.js"
import { projectUpdateRequestSchema } from "../projects/public/projectUpdateRequestSchema.js"
import { projectUserAssignmentCreateRequestSchema } from "../projects/public/projectUserAssignmentCreateRequestSchema.js"
import type { RealmTenantContext } from "../realms/server/index.js"
import { userCreate } from "../users/actions/userCreate.js"
import { userDelete } from "../users/actions/userDelete.js"
import { userEmailVerificationSet } from "../users/actions/userEmailVerificationSet.js"
import { userVerificationRequestSchema } from "../users/public/userVerificationRequestSchema.js"
import { userLifecycleSet } from "../users/actions/userLifecycleSet.js"
import { userMetadataRemove } from "../users/actions/userMetadataRemove.js"
import { userMetadataSet } from "../users/actions/userMetadataSet.js"
import { userProfileUpdate } from "../users/actions/userProfileUpdate.js"
import { userCreateRequestSchema } from "../users/public/userCreateRequestSchema.js"
import { userLifecycleRequestSchema } from "../users/public/userLifecycleRequestSchema.js"
import { userMetadataKeySchema } from "../users/public/userMetadataKeySchema.js"
import { userMetadataSetRequestSchema } from "../users/public/userMetadataSetRequestSchema.js"
import { userProfileUpdateRequestSchema } from "../users/public/userProfileUpdateRequestSchema.js"
import { userResourceIdSchema } from "../users/public/userResourceIdSchema.js"
import type { McpToolDefinition } from "./mcpToolRegistry.js"
import { mcpToolResult } from "./mcpToolResult.js"

// Mirrors mcpReadToolsRegister: scopes are informational only. Every tool
// registers regardless of scopes; the underlying action enforces the
// credential permission as the hard gate. Optional so existing callers that
// pass no scopes keep registering the full tool set.
type McpWriteToolsRegisterOptions = {
  readonly context: RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly scopes?: readonly string[]
}

export function mcpWriteToolsRegister(options: McpWriteToolsRegisterOptions): McpToolDefinition[] {
  const { context, database, realmId } = options
  const domainVerificationPort = organizationDomainDnsVerificationPortCreate()
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
      name: "organization-metadata-set",
      description: "Set an organization metadata entry by key. Inherits the credential permissions.",
      inputSchema: v.object({
        organizationId: organizationResourceIdSchema,
        key: organizationMetadataKeySchema,
        ...organizationMetadataSetRequestSchema.entries,
      }),
      run: async (args) => {
        const { organizationId, key, ...input } = args as v.InferInput<typeof organizationMetadataSetRequestSchema> & {
          organizationId: string
          key: string
        }
        const result = organizationMetadataSet({
          context,
          database,
          input,
          key,
          organizationId,
          realmId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "organization-metadata-remove",
      description: "Remove an organization metadata entry by key. Inherits the credential permissions.",
      inputSchema: v.object({
        organizationId: organizationResourceIdSchema,
        key: organizationMetadataKeySchema,
      }),
      run: async (args) => {
        const result = organizationMetadataRemove({
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
      name: "user-metadata-set",
      description: "Set a user metadata entry by key. Inherits the credential permissions.",
      inputSchema: v.object({
        userId: userResourceIdSchema,
        key: userMetadataKeySchema,
        ...userMetadataSetRequestSchema.entries,
      }),
      run: async (args) => {
        const { userId, key, ...input } = args as v.InferInput<typeof userMetadataSetRequestSchema> & {
          userId: string
          key: string
        }
        const result = userMetadataSet({
          context,
          database,
          input,
          key,
          realmId,
          userId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "user-metadata-remove",
      description: "Remove a user metadata entry by key. Inherits the credential permissions.",
      inputSchema: v.object({ userId: userResourceIdSchema, key: userMetadataKeySchema }),
      run: async (args) => {
        const result = userMetadataRemove({
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
    {
      name: "user-delete",
      description: "Delete a user by ID. Inherits the credential permissions.",
      inputSchema: v.object({ userId: userResourceIdSchema }),
      run: async (args) => {
        const result = await userDelete({
          context,
          database,
          realmId,
          userId: args.userId as string,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "user-email-verification-set",
      description: "Set a user email verification state by ID. Inherits the credential permissions.",
      inputSchema: v.object({
        userId: userResourceIdSchema,
        ...userVerificationRequestSchema.entries,
      }),
      run: async (args) => {
        const { userId, ...input } = args as v.InferInput<typeof userVerificationRequestSchema> & {
          userId: string
        }
        const result = userEmailVerificationSet({ context, database, input, realmId, userId })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "organization-login-policy-set",
      description: "Set an organization login policy by ID. Inherits the credential permissions.",
      inputSchema: v.object({
        organizationId: organizationResourceIdSchema,
        ...organizationLoginPolicySetRequestSchema.entries,
      }),
      run: async (args) => {
        const { organizationId, ...input } = args as v.InferInput<typeof organizationLoginPolicySetRequestSchema> & {
          organizationId: string
        }
        const result = organizationLoginPolicySet({ context, database, input, organizationId, realmId })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "organization-branding-set",
      description: "Set organization branding by ID. Inherits the credential permissions.",
      inputSchema: v.object({
        organizationId: organizationResourceIdSchema,
        ...organizationBrandingSetRequestSchema.entries,
      }),
      run: async (args) => {
        const { organizationId, ...input } = args as v.InferInput<typeof organizationBrandingSetRequestSchema> & {
          organizationId: string
        }
        const result = organizationBrandingSet({ context, database, input, organizationId, realmId })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "organization-domain-claim",
      description: "Claim an organization domain. Inherits the credential permissions.",
      inputSchema: v.object({
        organizationId: organizationResourceIdSchema,
        ...organizationDomainClaimRequestSchema.entries,
      }),
      run: async (args) => {
        const { organizationId, ...input } = args as v.InferInput<typeof organizationDomainClaimRequestSchema> & {
          organizationId: string
        }
        const result = organizationDomainClaim({ context, database, input, organizationId, realmId })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "organization-domain-verify",
      description: "Verify a claimed organization domain via DNS. Inherits the credential permissions.",
      inputSchema: v.object({
        domain: v.pipe(v.string(), v.minLength(1), v.maxLength(253)),
        organizationId: organizationResourceIdSchema,
      }),
      run: async (args) => {
        const result = await organizationDomainVerify({
          context,
          database,
          dnsPort: domainVerificationPort,
          domain: args.domain as string,
          organizationId: args.organizationId as string,
          realmId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "organization-domain-remove",
      description: "Remove an organization domain. Inherits the credential permissions.",
      inputSchema: v.object({
        domain: v.pipe(v.string(), v.minLength(1), v.maxLength(253)),
        organizationId: organizationResourceIdSchema,
      }),
      run: async (args) => {
        const result = organizationDomainRemove({
          context,
          database,
          domain: args.domain as string,
          organizationId: args.organizationId as string,
          realmId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "organization-lifecycle-set",
      description: "Set an organization lifecycle state by ID. Inherits the credential permissions.",
      inputSchema: v.object({
        organizationId: organizationResourceIdSchema,
        ...organizationLifecycleRequestSchema.entries,
      }),
      run: async (args) => {
        const { organizationId, ...input } = args as v.InferInput<typeof organizationLifecycleRequestSchema> & {
          organizationId: string
        }
        const result = organizationLifecycleSet({ context, database, input, organizationId, realmId })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "organization-membership-create",
      description: "Create an organization membership. Inherits the credential permissions.",
      inputSchema: v.object({
        organizationId: organizationResourceIdSchema,
        ...organizationMembershipCreateRequestSchema.entries,
      }),
      run: async (args) => {
        const { organizationId, ...input } = args as v.InferInput<typeof organizationMembershipCreateRequestSchema> & {
          organizationId: string
        }
        const result = organizationMembershipCreate({ context, database, input, organizationId, realmId })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "organization-membership-update",
      description: "Update an organization membership by ID. Inherits the credential permissions.",
      inputSchema: v.object({
        membershipId: organizationMembershipResourceIdSchema,
        organizationId: organizationResourceIdSchema,
        ...organizationMembershipUpdateRequestSchema.entries,
      }),
      run: async (args) => {
        const { organizationId, membershipId, ...input } = args as v.InferInput<
          typeof organizationMembershipUpdateRequestSchema
        > & { organizationId: string; membershipId: string }
        const result = organizationMembershipUpdate({
          context,
          database,
          input,
          membershipId,
          organizationId,
          realmId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "organization-membership-remove",
      description: "Remove an organization membership by ID. Inherits the credential permissions.",
      inputSchema: v.object({
        membershipId: organizationMembershipResourceIdSchema,
        organizationId: organizationResourceIdSchema,
      }),
      run: async (args) => {
        const result = organizationMembershipRemove({
          context,
          database,
          membershipId: args.membershipId as string,
          organizationId: args.organizationId as string,
          realmId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "organization-invitation-revoke",
      description: "Revoke an organization invitation by ID. Inherits the credential permissions.",
      inputSchema: v.object({
        invitationId: v.pipe(v.string(), v.minLength(1)),
        organizationId: organizationResourceIdSchema,
      }),
      run: async (args) => {
        const result = organizationInvitationRevoke({
          context,
          database,
          invitationId: args.invitationId as string,
          organizationId: args.organizationId as string,
          realmId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "project-role-create",
      description: "Create a project role. Inherits the credential permissions.",
      inputSchema: v.object({
        projectId: projectResourceIdSchema,
        ...projectRoleCreateRequestSchema.entries,
      }),
      run: async (args) => {
        const { projectId, ...input } = args as v.InferInput<typeof projectRoleCreateRequestSchema> & {
          projectId: string
        }
        const result = projectRoleCreate({ context, database, input, projectId, realmId })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "project-role-update",
      description: "Update a project role by ID. Inherits the credential permissions.",
      inputSchema: v.object({
        projectId: projectResourceIdSchema,
        roleId: v.pipe(v.string(), v.minLength(1)),
        ...projectRoleUpdateRequestSchema.entries,
      }),
      run: async (args) => {
        const { projectId, roleId, ...input } = args as v.InferInput<typeof projectRoleUpdateRequestSchema> & {
          projectId: string
          roleId: string
        }
        const result = projectRoleUpdate({ context, database, input, projectId, realmId, roleId })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "project-role-remove",
      description: "Remove a project role by ID. Inherits the credential permissions.",
      inputSchema: v.object({
        projectId: projectResourceIdSchema,
        roleId: v.pipe(v.string(), v.minLength(1)),
      }),
      run: async (args) => {
        const result = projectRoleDelete({
          context,
          database,
          projectId: args.projectId as string,
          realmId,
          roleId: args.roleId as string,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "project-grant-create",
      description: "Create a project grant. Inherits the credential permissions.",
      inputSchema: v.object({
        projectId: projectResourceIdSchema,
        ...projectGrantCreateRequestSchema.entries,
      }),
      run: async (args) => {
        const { projectId, ...input } = args as v.InferInput<typeof projectGrantCreateRequestSchema> & {
          projectId: string
        }
        const result = projectGrantCreate({ context, database, input, projectId, realmId })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "project-grant-update",
      description: "Update a project grant by ID. Inherits the credential permissions.",
      inputSchema: v.object({
        grantId: v.pipe(v.string(), v.minLength(1)),
        projectId: projectResourceIdSchema,
        ...projectGrantUpdateRequestSchema.entries,
      }),
      run: async (args) => {
        const { projectId, grantId, ...input } = args as v.InferInput<typeof projectGrantUpdateRequestSchema> & {
          projectId: string
          grantId: string
        }
        const result = projectGrantUpdate({ context, database, grantId, input, projectId, realmId })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "project-grant-remove",
      description: "Remove a project grant by ID. Inherits the credential permissions.",
      inputSchema: v.object({
        grantId: v.pipe(v.string(), v.minLength(1)),
        projectId: projectResourceIdSchema,
      }),
      run: async (args) => {
        const result = projectGrantDelete({
          context,
          database,
          grantId: args.grantId as string,
          projectId: args.projectId as string,
          realmId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "project-grant-lifecycle-set",
      description: "Set a project grant lifecycle state by ID. Inherits the credential permissions.",
      inputSchema: v.object({
        grantId: v.pipe(v.string(), v.minLength(1)),
        projectId: projectResourceIdSchema,
        ...projectGrantLifecycleRequestSchema.entries,
      }),
      run: async (args) => {
        const { projectId, grantId, ...input } = args as v.InferInput<typeof projectGrantLifecycleRequestSchema> & {
          projectId: string
          grantId: string
        }
        const result = projectGrantLifecycleSet({ context, database, grantId, input, projectId, realmId })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "project-user-assignment-create",
      description: "Create a project user assignment. Inherits the credential permissions.",
      inputSchema: v.object({
        projectId: projectResourceIdSchema,
        ...projectUserAssignmentCreateRequestSchema.entries,
      }),
      run: async (args) => {
        const { projectId, ...input } = args as v.InferInput<typeof projectUserAssignmentCreateRequestSchema> & {
          projectId: string
        }
        const result = projectUserAssignmentCreate({ context, database, input, projectId, realmId })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "project-user-assignment-remove",
      description: "Remove a project user assignment by ID. Inherits the credential permissions.",
      inputSchema: v.object({
        assignmentId: v.pipe(v.string(), v.minLength(1)),
        projectId: projectResourceIdSchema,
      }),
      run: async (args) => {
        const result = projectUserAssignmentRemove({
          assignmentId: args.assignmentId as string,
          context,
          database,
          projectId: args.projectId as string,
          realmId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "project-application-create",
      description: "Create a project application. Inherits the credential permissions.",
      inputSchema: v.object({
        projectId: projectResourceIdSchema,
        ...projectApplicationCreateRequestSchema.entries,
      }),
      run: async (args) => {
        const { projectId, ...input } = args as v.InferInput<typeof projectApplicationCreateRequestSchema> & {
          projectId: string
        }
        const result = projectApplicationCreate({ context, database, input, projectId, realmId })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "project-application-update",
      description: "Update a project application by ID. Inherits the credential permissions.",
      inputSchema: v.object({
        applicationId: v.pipe(v.string(), v.minLength(1)),
        projectId: projectResourceIdSchema,
        ...projectApplicationUpdateRequestSchema.entries,
      }),
      run: async (args) => {
        const { projectId, applicationId, ...input } = args as v.InferInput<
          typeof projectApplicationUpdateRequestSchema
        > & { projectId: string; applicationId: string }
        const result = projectApplicationUpdate({
          applicationId,
          context,
          database,
          input,
          projectId,
          realmId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
    {
      name: "project-application-remove",
      description: "Remove a project application by ID. Inherits the credential permissions.",
      inputSchema: v.object({
        applicationId: v.pipe(v.string(), v.minLength(1)),
        projectId: projectResourceIdSchema,
      }),
      run: async (args) => {
        const result = projectApplicationDelete({
          applicationId: args.applicationId as string,
          context,
          database,
          projectId: args.projectId as string,
          realmId,
        })
        return mcpToolResult(result, !result.success)
      },
    },
  ]
}
