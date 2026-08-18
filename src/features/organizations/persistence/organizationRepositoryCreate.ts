import { and, asc, eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { type OrganizationInvitationRow, organizationInvitationTable } from "./organizationInvitationTable.js"
import { type OrganizationMembershipRow, organizationMembershipTable } from "./organizationMembershipTable.js"
import { type OrganizationRow, organizationTable } from "./organizationTable.js"

type OrganizationInsert = typeof organizationTable.$inferInsert
type OrganizationUpdate = Partial<OrganizationInsert>
type OrganizationMembershipInsert = typeof organizationMembershipTable.$inferInsert
type OrganizationMembershipUpdate = Partial<OrganizationMembershipInsert>
type OrganizationInvitationInsert = typeof organizationInvitationTable.$inferInsert
type OrganizationInvitationUpdate = Partial<OrganizationInvitationInsert>

export function organizationRepositoryCreate(database: StorageExecutor) {
  return {
    organizationCreate(input: OrganizationInsert): Result<OrganizationRow> {
      try {
        const organization = database.insert(organizationTable).values(input).returning().get()
        if (organization === undefined)
          return resultErrorCreate("organizationCreate", "The organization could not be created.")
        return resultCreate(organization)
      } catch (_error) {
        return resultErrorCreate("organizationCreate", "The organization could not be created.")
      }
    },

    organizationGet(organizationId: string): Result<OrganizationRow | null> {
      try {
        return resultCreate(
          database.select().from(organizationTable).where(eq(organizationTable.id, organizationId)).get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("organizationGet", "The organization could not be read.")
      }
    },

    organizationList(realmId: string): Result<OrganizationRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(organizationTable)
            .where(eq(organizationTable.realmId, realmId))
            .orderBy(asc(organizationTable.createdAt))
            .all(),
        )
      } catch (_error) {
        return resultErrorCreate("organizationList", "The organizations could not be read.")
      }
    },

    organizationUpdate(organizationId: string, input: OrganizationUpdate): Result<OrganizationRow | null> {
      try {
        return resultCreate(
          database
            .update(organizationTable)
            .set(input)
            .where(eq(organizationTable.id, organizationId))
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("organizationUpdate", "The organization could not be updated.")
      }
    },

    organizationMembershipCreate(input: OrganizationMembershipInsert): Result<OrganizationMembershipRow> {
      try {
        const membership = database.insert(organizationMembershipTable).values(input).returning().get()
        if (membership === undefined)
          return resultErrorCreate("organizationMembershipCreate", "The organization membership could not be created.")
        return resultCreate(membership)
      } catch (_error) {
        return resultErrorCreate("organizationMembershipCreate", "The organization membership could not be created.")
      }
    },

    organizationMembershipDelete(membershipId: string): Result<OrganizationMembershipRow | null> {
      try {
        return resultCreate(
          database
            .delete(organizationMembershipTable)
            .where(eq(organizationMembershipTable.id, membershipId))
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("organizationMembershipDelete", "The organization membership could not be removed.")
      }
    },

    organizationMembershipGet(membershipId: string): Result<OrganizationMembershipRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(organizationMembershipTable)
            .where(eq(organizationMembershipTable.id, membershipId))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("organizationMembershipGet", "The organization membership could not be read.")
      }
    },

    organizationMembershipGetByOrganizationUser(
      organizationId: string,
      userId: string,
    ): Result<OrganizationMembershipRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(organizationMembershipTable)
            .where(
              and(
                eq(organizationMembershipTable.organizationId, organizationId),
                eq(organizationMembershipTable.userId, userId),
              ),
            )
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "organizationMembershipGetByOrganizationUser",
          "The organization membership could not be read.",
        )
      }
    },

    organizationMembershipList(organizationId: string): Result<OrganizationMembershipRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(organizationMembershipTable)
            .where(eq(organizationMembershipTable.organizationId, organizationId))
            .orderBy(asc(organizationMembershipTable.createdAt))
            .all(),
        )
      } catch (_error) {
        return resultErrorCreate("organizationMembershipList", "The organization memberships could not be read.")
      }
    },

    organizationMembershipUpdate(
      membershipId: string,
      input: OrganizationMembershipUpdate,
    ): Result<OrganizationMembershipRow | null> {
      try {
        return resultCreate(
          database
            .update(organizationMembershipTable)
            .set(input)
            .where(eq(organizationMembershipTable.id, membershipId))
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("organizationMembershipUpdate", "The organization membership could not be updated.")
      }
    },

    organizationInvitationCreate(input: OrganizationInvitationInsert): Result<OrganizationInvitationRow> {
      try {
        const invitation = database.insert(organizationInvitationTable).values(input).returning().get()
        if (invitation === undefined)
          return resultErrorCreate("organizationInvitationCreate", "The organization invitation could not be created.")
        return resultCreate(invitation)
      } catch (_error) {
        return resultErrorCreate("organizationInvitationCreate", "The organization invitation could not be created.")
      }
    },

    organizationInvitationGet(invitationId: string): Result<OrganizationInvitationRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(organizationInvitationTable)
            .where(eq(organizationInvitationTable.id, invitationId))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("organizationInvitationGet", "The organization invitation could not be read.")
      }
    },

    organizationInvitationGetByTokenHash(tokenHash: string): Result<OrganizationInvitationRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(organizationInvitationTable)
            .where(eq(organizationInvitationTable.tokenHash, tokenHash))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "organizationInvitationGetByTokenHash",
          "The organization invitation could not be read.",
        )
      }
    },

    organizationInvitationList(organizationId: string): Result<OrganizationInvitationRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(organizationInvitationTable)
            .where(eq(organizationInvitationTable.organizationId, organizationId))
            .orderBy(asc(organizationInvitationTable.createdAt))
            .all(),
        )
      } catch (_error) {
        return resultErrorCreate("organizationInvitationList", "The organization invitations could not be read.")
      }
    },

    organizationInvitationPendingByEmail(
      organizationId: string,
      email: string,
    ): Result<OrganizationInvitationRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(organizationInvitationTable)
            .where(
              and(
                eq(organizationInvitationTable.organizationId, organizationId),
                eq(organizationInvitationTable.email, email),
                eq(organizationInvitationTable.status, "pending"),
              ),
            )
            .orderBy(asc(organizationInvitationTable.createdAt))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "organizationInvitationPendingByEmail",
          "The organization invitation could not be read.",
        )
      }
    },

    organizationInvitationUpdate(
      invitationId: string,
      input: OrganizationInvitationUpdate,
    ): Result<OrganizationInvitationRow | null> {
      try {
        return resultCreate(
          database
            .update(organizationInvitationTable)
            .set(input)
            .where(eq(organizationInvitationTable.id, invitationId))
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("organizationInvitationUpdate", "The organization invitation could not be updated.")
      }
    },
  }
}
