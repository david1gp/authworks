import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { TeamLeaderSummary } from "../public/teamLeaderSummarySchema.js"
import type { Team } from "../public/teamSchema.js"
import type { TeamRow } from "../persistence/teamTable.js"

type TeamPublicViewCreateOptions = {
  readonly row: TeamRow
  readonly memberCount: number
  readonly leader: TeamLeaderSummary
}

export function teamPublicViewCreate(options: TeamPublicViewCreateOptions): Result<Team> {
  const op = "teamPublicViewCreate"
  if (!Number.isSafeInteger(options.memberCount) || options.memberCount < 0)
    return resultErrorCodedCreate(op, "The team member count is invalid.", "teams.invalid")
  return resultCreate({
    createdAt: options.row.createdAt,
    id: options.row.id,
    leader: options.leader,
    memberCount: options.memberCount,
    name: options.row.name,
    organizationId: options.row.organizationId,
    realmId: options.row.realmId,
    slug: options.row.slug,
    updatedAt: options.row.updatedAt,
  })
}
