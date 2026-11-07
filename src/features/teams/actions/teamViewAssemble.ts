import { type Result } from "#result"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { userSessionDisplayList } from "../../users/server/userSessionDisplayList.js"
import { teamPublicViewCreate } from "../domain/teamPublicViewCreate.js"
import type { TeamRow } from "../persistence/teamTable.js"
import type { Team } from "../public/teamSchema.js"

type TeamViewAssembleOptions = {
  readonly database: StorageDatabase
  readonly realmId: string
  readonly row: TeamRow
  readonly memberCount: number
}

export function teamViewAssemble(options: TeamViewAssembleOptions): Result<Team> {
  const names = userSessionDisplayList({
    database: options.database,
    realmId: options.realmId,
    userIds: [options.row.leaderUserId],
  })
  if (!names.success) return names
  const leader = names.data.find((candidate) => candidate.id === options.row.leaderUserId)
  return teamPublicViewCreate({
    leader: {
      displayName: leader?.displayName ?? null,
      email: leader?.email ?? null,
      userId: options.row.leaderUserId,
    },
    memberCount: options.memberCount,
    row: options.row,
  })
}
