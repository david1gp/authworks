import type { MachineUser } from "../../machineUsers/public/machineUserSchema.js"
import type { OrganizationInvitation } from "../../organizations/public/organizationInvitationSchema.js"
import type { DirectoryEntry } from "../public/directoryEntrySchema.js"
import {
  directoryAdminDemoInvitations,
  directoryAdminDemoPeople,
  directoryAdminDemoServiceAccounts,
  directoryAdminDemoTeams,
} from "./directoryAdminDemoDirectoryFixtures.js"

export type DirectoryAdminDemoTeamRecord = {
  id: string
  leaderUserId: string
  name: string
  slug: string
}

export type DirectoryAdminDemoDirectoryStore = {
  readonly invitations: OrganizationInvitation[]
  readonly people: DirectoryEntry[]
  readonly serviceAccounts: MachineUser[]
  readonly teams: DirectoryAdminDemoTeamRecord[]
}

/**
 * One shared in-memory copy of the demo directory fixtures. The users and
 * teams demo adapters receive the same store so team assignments stay visible
 * on both the People and Teams tabs.
 */
export function directoryAdminDemoDirectoryStoreCreate(): DirectoryAdminDemoDirectoryStore {
  return {
    invitations: directoryAdminDemoInvitations.map((invitation) => ({
      ...invitation,
      ...(invitation.invitedBy === null ? {} : { invitedBy: { ...invitation.invitedBy } }),
      roles: [...invitation.roles],
      ...(invitation.team === null ? {} : { team: { ...invitation.team } }),
    })),
    people: directoryAdminDemoPeople.map((entry) => ({
      memberships: entry.memberships.map((membership) => ({ ...membership, roles: [...membership.roles] })),
      team: entry.team === null ? null : { ...entry.team },
      user: { ...entry.user },
    })),
    serviceAccounts: directoryAdminDemoServiceAccounts.map((account) => ({
      ...account,
      scopes: [...account.scopes],
    })),
    teams: directoryAdminDemoTeams.map((team) => ({
      id: team.id,
      leaderUserId: team.leaderUserId,
      name: team.name,
      slug: team.slug,
    })),
  }
}
