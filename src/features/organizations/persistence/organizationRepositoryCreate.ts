import { and, asc, eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
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
          return resultErrorCodedCreate(
            "organizationCreate",
            "The organization could not be created.",
            "organizations.write-failed",
          )
        return resultCreate(organization)
      } catch (_error) {
        return resultErrorCodedCreate(
          "organizationCreate",
          "The organization could not be created.",
          "organizations.write-failed",
        )
      }
    },

    organizationGet(organizationId: string): Result<OrganizationRow | null> {
      try {
        return resultCreate(
          database.select().from(organizationTable).where(eq(organizationTable.id, organizationId)).get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "organizationGet",
          "The organization could not be read.",
          "organizations.read-failed",
        )
      }
    },

    organizationList(realmId: string): Result<OrganizationRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(organizationTable)
            .where(eq(organizationTable.realmId, realmId))
            .orderBy(asc(organizationTable.createdAt), asc(organizationTable.id))
            .all(),
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "organizationList",
          "The organizations could not be read.",
          "organizations.read-failed",
        )
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
        return resultErrorCodedCreate(
          "organizationUpdate",
          "The organization could not be updated.",
          "organizations.write-failed",
        )
      }
    },

    organizationMembershipCreate(input: OrganizationMembershipInsert): Result<OrganizationMembershipRow> {
      try {
        const membership = database.insert(organizationMembershipTable).values(input).returning().get()
        if (membership === undefined)
          return resultErrorCodedCreate(
            "organizationMembershipCreate",
            "The organization membership could not be created.",
            "organizations.write-failed",
          )
        return resultCreate(membership)
      } catch (_error) {
        return resultErrorCodedCreate(
          "organizationMembershipCreate",
          "The organization membership could not be created.",
          "organizations.write-failed",
        )
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
        return resultErrorCodedCreate(
          "organizationMembershipDelete",
          "The organization membership could not be removed.",
          "organizations.write-failed",
        )
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
        return resultErrorCodedCreate(
          "organizationMembershipGet",
          "The organization membership could not be read.",
          "organizations.read-failed",
        )
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
        return resultErrorCodedCreate(
          "organizationMembershipGetByOrganizationUser",
          "The organization membership could not be read.",
          "organizations.read-failed",
        )
      }
    },

    organizationMembershipListByRealmUser(realmId: string, userId: string): Result<OrganizationMembershipRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(organizationMembershipTable)
            .where(
              and(eq(organizationMembershipTable.realmId, realmId), eq(organizationMembershipTable.userId, userId)),
            )
            .orderBy(asc(organizationMembershipTable.createdAt), asc(organizationMembershipTable.id))
            .all(),
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "organizationMembershipListByRealmUser",
          "The organization memberships could not be read.",
          "organizations.read-failed",
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
            .orderBy(asc(organizationMembershipTable.createdAt), asc(organizationMembershipTable.id))
            .all(),
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "organizationMembershipList",
          "The organization memberships could not be read.",
          "organizations.read-failed",
        )
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
        return resultErrorCodedCreate(
          "organizationMembershipUpdate",
          "The organization membership could not be updated.",
          "organizations.write-failed",
        )
      }
    },

    organizationInvitationCreate(input: OrganizationInvitationInsert): Result<OrganizationInvitationRow> {
      try {
        const invitation = database.insert(organizationInvitationTable).values(input).returning().get()
        if (invitation === undefined)
          return resultErrorCodedCreate(
            "organizationInvitationCreate",
            "The organization invitation could not be created.",
            "organizations.write-failed",
          )
        return resultCreate(invitation)
      } catch (_error) {
        return resultErrorCodedCreate(
          "organizationInvitationCreate",
          "The organization invitation could not be created.",
          "organizations.write-failed",
        )
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
        return resultErrorCodedCreate(
          "organizationInvitationGet",
          "The organization invitation could not be read.",
          "organizations.read-failed",
        )
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
        return resultErrorCodedCreate(
          "organizationInvitationGetByTokenHash",
          "The organization invitation could not be read.",
          "organizations.read-failed",
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
            .orderBy(asc(organizationInvitationTable.createdAt), asc(organizationInvitationTable.id))
            .all(),
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "organizationInvitationList",
          "The organization invitations could not be read.",
          "organizations.read-failed",
        )
      }
    },

    organizationInvitationListByRealmEmail(realmId: string, email: string): Result<OrganizationInvitationRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(organizationInvitationTable)
            .where(
              and(
                eq(organizationInvitationTable.realmId, realmId),
                eq(organizationInvitationTable.email, email),
                eq(organizationInvitationTable.status, "pending"),
              ),
            )
            .orderBy(asc(organizationInvitationTable.createdAt), asc(organizationInvitationTable.id))
            .all(),
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "organizationInvitationListByRealmEmail",
          "The organization invitations could not be read.",
          "organizations.read-failed",
        )
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
        return resultErrorCodedCreate(
          "organizationInvitationPendingByEmail",
          "The organization invitation could not be read.",
          "organizations.read-failed",
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
        return resultErrorCodedCreate(
          "organizationInvitationUpdate",
          "The organization invitation could not be updated.",
          "organizations.write-failed",
        )
      }
    },
  }
}
