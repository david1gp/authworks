import type { AuthorizationRoleDefinition } from "../public/authorizationRoleDefinitionSchema.js"
import { authorizationPermissionDefinitions } from "./authorizationPermissionDefinitions.js"

export const authorizationFixedRoleDefinitions: readonly AuthorizationRoleDefinition[] = [
  {
    name: "Organization owner",
    permissions: [
      authorizationPermissionDefinitions.organizationManage,
      authorizationPermissionDefinitions.organizationMembersManage,
      authorizationPermissionDefinitions.organizationRead,
      authorizationPermissionDefinitions.organizationSwitch,
    ],
    roleId: "owner",
  },
  {
    name: "Organization administrator",
    permissions: [
      authorizationPermissionDefinitions.organizationManage,
      authorizationPermissionDefinitions.organizationMembersManage,
      authorizationPermissionDefinitions.organizationRead,
      authorizationPermissionDefinitions.organizationSwitch,
    ],
    roleId: "admin",
  },
  {
    name: "Organization member",
    permissions: [
      authorizationPermissionDefinitions.organizationRead,
      authorizationPermissionDefinitions.organizationSwitch,
    ],
    roleId: "member",
  },
  {
    name: "Organization guest",
    permissions: [],
    roleId: "guest",
  },
  {
    name: "Instance administrator",
    permissions: [
      authorizationPermissionDefinitions.instanceRead,
      authorizationPermissionDefinitions.instanceWrite,
      authorizationPermissionDefinitions.organizationManage,
      authorizationPermissionDefinitions.organizationMembersManage,
      authorizationPermissionDefinitions.organizationRead,
      authorizationPermissionDefinitions.organizationSwitch,
      authorizationPermissionDefinitions.userManage,
      authorizationPermissionDefinitions.userRead,
    ],
    roleId: "instance_admin",
  },
]
