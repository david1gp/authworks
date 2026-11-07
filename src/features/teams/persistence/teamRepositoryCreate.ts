import { and, asc, eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { type TeamMembershipRow, teamMembershipTable } from "./teamMembershipTable.js"
import { type TeamRow, teamTable } from "./teamTable.js"

type TeamInsert = typeof teamTable.$inferInsert
type TeamUpdate = Partial<TeamInsert>
type TeamMembershipInsert = typeof teamMembershipTable.$inferInsert

export function teamRepositoryCreate(database: StorageExecutor) {
  return {
    teamCreate(input: TeamInsert): Result<TeamRow> {
      try {
        const team = database.insert(teamTable).values(input).returning().get()
        if (team === undefined)
          return resultErrorCodedCreate("teamCreate", "The team could not be created.", "teams.write-failed")
        return resultCreate(team)
      } catch (_error) {
        return resultErrorCodedCreate("teamCreate", "The team could not be created.", "teams.write-failed")
      }
    },

    teamGet(teamId: string): Result<TeamRow | null> {
      try {
        return resultCreate(database.select().from(teamTable).where(eq(teamTable.id, teamId)).get() ?? null)
      } catch (_error) {
        return resultErrorCodedCreate("teamGet", "The team could not be read.", "teams.read-failed")
      }
    },

    teamGetBySlug(organizationId: string, slug: string): Result<TeamRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(teamTable)
            .where(and(eq(teamTable.organizationId, organizationId), eq(teamTable.slug, slug)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate("teamGetBySlug", "The team could not be read.", "teams.read-failed")
      }
    },

    teamGetByName(organizationId: string, name: string): Result<TeamRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(teamTable)
            .where(and(eq(teamTable.organizationId, organizationId), eq(teamTable.name, name)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate("teamGetByName", "The team could not be read.", "teams.read-failed")
      }
    },

    teamList(organizationId: string): Result<TeamRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(teamTable)
            .where(eq(teamTable.organizationId, organizationId))
            .orderBy(asc(teamTable.createdAt), asc(teamTable.id))
            .all(),
        )
      } catch (_error) {
        return resultErrorCodedCreate("teamList", "The teams could not be read.", "teams.read-failed")
      }
    },

    teamListByLeader(organizationId: string, leaderUserId: string): Result<TeamRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(teamTable)
            .where(and(eq(teamTable.organizationId, organizationId), eq(teamTable.leaderUserId, leaderUserId)))
            .orderBy(asc(teamTable.createdAt), asc(teamTable.id))
            .all(),
        )
      } catch (_error) {
        return resultErrorCodedCreate("teamListByLeader", "The teams could not be read.", "teams.read-failed")
      }
    },

    teamUpdate(teamId: string, input: TeamUpdate): Result<TeamRow | null> {
      try {
        return resultCreate(
          database.update(teamTable).set(input).where(eq(teamTable.id, teamId)).returning().get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate("teamUpdate", "The team could not be updated.", "teams.write-failed")
      }
    },

    teamDelete(teamId: string): Result<TeamRow | null> {
      try {
        return resultCreate(database.delete(teamTable).where(eq(teamTable.id, teamId)).returning().get() ?? null)
      } catch (_error) {
        return resultErrorCodedCreate("teamDelete", "The team could not be deleted.", "teams.write-failed")
      }
    },

    teamMembershipCreate(input: TeamMembershipInsert): Result<TeamMembershipRow> {
      try {
        const membership = database.insert(teamMembershipTable).values(input).returning().get()
        if (membership === undefined)
          return resultErrorCodedCreate(
            "teamMembershipCreate",
            "The team membership could not be created.",
            "teams.write-failed",
          )
        return resultCreate(membership)
      } catch (_error) {
        return resultErrorCodedCreate(
          "teamMembershipCreate",
          "The team membership could not be created.",
          "teams.write-failed",
        )
      }
    },

    teamMembershipGetByOrganizationUser(organizationId: string, userId: string): Result<TeamMembershipRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(teamMembershipTable)
            .where(and(eq(teamMembershipTable.organizationId, organizationId), eq(teamMembershipTable.userId, userId)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "teamMembershipGetByOrganizationUser",
          "The team membership could not be read.",
          "teams.read-failed",
        )
      }
    },

    teamMembershipListByTeam(teamId: string): Result<TeamMembershipRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(teamMembershipTable)
            .where(eq(teamMembershipTable.teamId, teamId))
            .orderBy(asc(teamMembershipTable.createdAt), asc(teamMembershipTable.id))
            .all(),
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "teamMembershipListByTeam",
          "The team memberships could not be read.",
          "teams.read-failed",
        )
      }
    },

    teamMembershipListByOrganization(organizationId: string): Result<TeamMembershipRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(teamMembershipTable)
            .where(eq(teamMembershipTable.organizationId, organizationId))
            .orderBy(asc(teamMembershipTable.createdAt), asc(teamMembershipTable.id))
            .all(),
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "teamMembershipListByOrganization",
          "The team memberships could not be read.",
          "teams.read-failed",
        )
      }
    },

    teamMembershipDeleteByOrganizationUser(organizationId: string, userId: string): Result<TeamMembershipRow | null> {
      try {
        return resultCreate(
          database
            .delete(teamMembershipTable)
            .where(and(eq(teamMembershipTable.organizationId, organizationId), eq(teamMembershipTable.userId, userId)))
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "teamMembershipDeleteByOrganizationUser",
          "The team membership could not be removed.",
          "teams.write-failed",
        )
      }
    },
  }
}
