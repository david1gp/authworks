import type { Result } from "#result"
import { sessionCsrfTokenGet } from "../../sessions/client/sessionCsrfTokenGet.js"
import { directoryApiClientCreate } from "../client/directoryApiClientCreate.js"
import type { DirectoryUserListQuery } from "../public/directoryUserListSchema.js"
import { teamApiClientCreate } from "../../teams/client/teamApiClientCreate.js"
import type { TeamCreateRequest } from "../../teams/public/teamCreateRequestSchema.js"
import type { TeamMemberAssignRequest } from "../../teams/public/teamMemberAssignRequestSchema.js"
import type { TeamUpdateRequest } from "../../teams/public/teamUpdateRequestSchema.js"
import type { DirectoryTeamsAdapter } from "./directoryTeamsAdapter.js"

type DirectoryTeamsFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

/**
 * Production adapter. Every call is realm-scoped and cookie-authenticated, so tenant
 * boundaries, permissions, and assurance are enforced by the server rather than the view.
 * Writes carry a fresh realm-scoped CSRF token; reads reuse the session cookie.
 */
export function directoryTeamsProductionAdapterCreate(options: {
  readonly baseUrl: string
  readonly fetch?: DirectoryTeamsFetch
  readonly organizationId: () => string
  readonly realmId: () => string
}): DirectoryTeamsAdapter {
  const browserFetch: DirectoryTeamsFetch = (input, init) =>
    (options.fetch ?? fetch)(input, { ...init, credentials: "include" })
  const realm = () => options.realmId()
  const organization = () => options.organizationId()
  const teamsWrite = async <T>(
    run: (clients: {
      directory: ReturnType<typeof directoryApiClientCreate>
      teams: ReturnType<typeof teamApiClientCreate>
    }) => Promise<Result<T>>,
  ): Promise<Result<T>> => {
    const csrf = await sessionCsrfTokenGet({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      realmId: realm(),
    })
    if (!csrf.success) return csrf
    return run({
      directory: directoryApiClientCreate({ baseUrl: options.baseUrl, csrfToken: csrf.data, fetch: browserFetch }),
      teams: teamApiClientCreate({ baseUrl: options.baseUrl, csrfToken: csrf.data, fetch: browserFetch }),
    })
  }

  return {
    organizationUserList: (query?: DirectoryUserListQuery) =>
      directoryApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch }).directoryOrganizationUserList(
        realm(),
        organization(),
        query === undefined ? undefined : { ...query },
      ),
    teamCreate: (input: TeamCreateRequest) =>
      teamsWrite((clients) => clients.teams.teamCreate(realm(), organization(), input)),
    teamDelete: (teamRef: string) =>
      teamsWrite((clients) => clients.teams.teamDelete(realm(), organization(), teamRef)),
    teamList: () =>
      teamApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch }).teamList(realm(), organization()),
    teamMemberAssign: (teamRef: string, input: TeamMemberAssignRequest) =>
      teamsWrite((clients) => clients.teams.teamMemberAssign(realm(), organization(), teamRef, input)),
    teamMemberUnassign: (teamRef: string, userId: string) =>
      teamsWrite((clients) => clients.teams.teamMemberUnassign(realm(), organization(), teamRef, userId)),
    teamUpdate: (teamRef: string, input: TeamUpdateRequest) =>
      teamsWrite((clients) => clients.teams.teamUpdate(realm(), organization(), teamRef, input)),
  }
}
