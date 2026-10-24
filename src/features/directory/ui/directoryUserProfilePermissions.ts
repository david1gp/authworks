import type { AuthenticatedChipTone } from "../../../ui/authenticated/authenticatedChipTone.js"
import type { AuthenticatedStatusTone } from "../../../ui/authenticated/authenticatedStatusTone.js"
import type { OrganizationRoleId } from "../../organizations/public/organizationRoleIdSchema.js"
import type { UserState } from "../../users/public/userStateSchema.js"

export type DirectoryUserProfileActor = {
  /** Organization roles of the actor in the active organization. */
  readonly organizationRoles: readonly OrganizationRoleId[]
  readonly realmAdministrator: boolean
}

export type DirectoryUserProfileTarget = {
  /** Whether the target is a realm administrator. */
  readonly realmAdministrator: boolean
  /** Primary org roles of the target in the active organization, or undefined when not a member. */
  readonly roles: readonly OrganizationRoleId[] | undefined
}

const lifecycleChipTones: Record<UserState, AuthenticatedChipTone> = {
  active: "success",
  deleted: "danger",
  inactive: "warning",
  initial: "neutral",
  locked: "danger",
  suspended: "warning",
}

/** Maps a user lifecycle state to the compact chip tone shown in the profile header. */
export function directoryUserProfileStateTone(state: UserState): AuthenticatedChipTone {
  return lifecycleChipTones[state]
}

/** Maps a user lifecycle state to the status pill tone shown in the profile header. */
export function directoryUserProfileStatusTone(state: UserState): AuthenticatedStatusTone {
  return lifecycleChipTones[state]
}

const actorManagesOwners = (actor: DirectoryUserProfileActor): boolean =>
  actor.realmAdministrator || actor.organizationRoles.includes("owner")

const targetHasOwnerRole = (target: DirectoryUserProfileTarget): boolean =>
  target.roles?.includes("owner") ?? false

/**
 * Resolves which profile actions the actor may perform on the target. Realm administrators may
 * act on anyone. Organization owners and admins manage members of the organization they
 * administer — admins never touch owners, owners additionally manage owners. Nobody but a
 * realm administrator may act on a realm administrator.
 */
export function directoryUserProfilePermissionsResolve(
  actor: DirectoryUserProfileActor,
  target: DirectoryUserProfileTarget,
): {
  readonly activate: boolean
  readonly assignRoles: boolean
  readonly delete: boolean
  readonly editProfile: boolean
  readonly grantRealmAdministrator: boolean
  readonly impersonate: boolean
  readonly manageOrganizationRole: boolean
  readonly manageProjectAssignments: boolean
  readonly revokeRealmAdministrator: boolean
  readonly setPassword: boolean
  readonly unlock: boolean
} {
  const managesTarget =
    actor.realmAdministrator ||
    (!target.realmAdministrator && actorManagesOwners(actor)) ||
    (!target.realmAdministrator && !targetHasOwnerRole(target) && actor.organizationRoles.includes("admin"))
  const lifecycle = managesTarget
  const organizationRole =
    managesTarget &&
    (actor.realmAdministrator || actor.organizationRoles.includes("owner") || actor.organizationRoles.includes("admin"))
  const mayGrantOwner = actorManagesOwners(actor)
  return {
    activate: lifecycle,
    assignRoles: managesTarget,
    delete: lifecycle,
    editProfile: managesTarget,
    grantRealmAdministrator: actor.realmAdministrator && !target.realmAdministrator,
    impersonate: managesTarget,
    manageOrganizationRole: organizationRole && (mayGrantOwner || !targetHasOwnerRole(target)),
    manageProjectAssignments: managesTarget,
    revokeRealmAdministrator: actor.realmAdministrator && target.realmAdministrator,
    setPassword: actor.realmAdministrator,
    unlock: lifecycle,
  }
}
