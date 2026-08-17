import type { AuthorizationPermission } from "../public/authorizationPermissionSchema.js"

export const authorizationPermissionDefinitions = {
  instanceRead: "instance.read",
  instanceWrite: "instance.write",
  organizationManage: "organization.manage",
  organizationMembersManage: "organization.members.manage",
  organizationRead: "organization.read",
  organizationSwitch: "organization.switch",
  userManage: "user.manage",
  userRead: "user.read",
} as const satisfies Record<string, AuthorizationPermission>
