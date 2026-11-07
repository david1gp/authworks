import type { Result } from "#result"
import type { TeamCreateRequest } from "../../teams/public/teamCreateRequestSchema.js"
import type { TeamDeleteResponse } from "../../teams/public/teamDeleteResponseSchema.js"
import type { TeamListResponse } from "../../teams/public/teamListResponseSchema.js"
import type { TeamMemberAssignRequest } from "../../teams/public/teamMemberAssignRequestSchema.js"
import type { TeamMemberAssignResponse } from "../../teams/public/teamMemberAssignResponseSchema.js"
import type { TeamMemberUnassignResponse } from "../../teams/public/teamMemberUnassignResponseSchema.js"
import type { TeamResponse } from "../../teams/public/teamResponseSchema.js"
import type { TeamUpdateRequest } from "../../teams/public/teamUpdateRequestSchema.js"
import type { DirectoryUserListQuery, DirectoryUserListResponse } from "../public/directoryUserListSchema.js"

/**
 * The single boundary separating the shared stateless teams UI from its
 * production (network) and demo (fixture) data sources.
 */
export type DirectoryTeamsAdapter = {
  /** Lists organization members; used for team detail lists and the add-member picker. */
  readonly organizationUserList: (query?: DirectoryUserListQuery) => Promise<Result<DirectoryUserListResponse>>
  readonly teamCreate: (input: TeamCreateRequest) => Promise<Result<TeamResponse>>
  readonly teamDelete: (teamRef: string) => Promise<Result<TeamDeleteResponse>>
  readonly teamList: () => Promise<Result<TeamListResponse>>
  readonly teamMemberAssign: (
    teamRef: string,
    input: TeamMemberAssignRequest,
  ) => Promise<Result<TeamMemberAssignResponse>>
  readonly teamMemberUnassign: (teamRef: string, userId: string) => Promise<Result<TeamMemberUnassignResponse>>
  readonly teamUpdate: (teamRef: string, input: TeamUpdateRequest) => Promise<Result<TeamResponse>>
}
