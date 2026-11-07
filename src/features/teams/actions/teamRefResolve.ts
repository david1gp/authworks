import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { teamRepositoryCreate } from "../persistence/teamRepositoryCreate.js"
import type { TeamRow } from "../persistence/teamTable.js"

type TeamRefResolveOptions = {
  readonly organizationId: string
  readonly teamRef: string
  readonly repository: ReturnType<typeof teamRepositoryCreate>
}

export function teamRefResolve(options: TeamRefResolveOptions): Result<TeamRow | null> {
  const byId = options.repository.teamGet(options.teamRef)
  if (!byId.success) return byId
  if (byId.data !== null && byId.data.organizationId === options.organizationId) return resultCreate(byId.data)
  const bySlug = options.repository.teamGetBySlug(options.organizationId, options.teamRef)
  if (!bySlug.success) return bySlug
  return resultCreate(bySlug.data)
}
