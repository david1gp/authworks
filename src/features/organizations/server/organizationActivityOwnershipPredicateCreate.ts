import { and, eq, inArray, or, sql } from "drizzle-orm"
import { storageEventTable } from "../../../platform/storage/storageEventTable.js"
import { projectActivityOwnershipPredicateCreate } from "../../projects/server/projectActivityOwnershipPredicateCreate.js"
import { organizationEventTypes } from "../events/organizationEventTypes.js"
import { organizationInvitationTable } from "../persistence/organizationInvitationTable.js"
import { organizationMembershipTable } from "../persistence/organizationMembershipTable.js"

/** Deleted ownership records and reassignable domain aggregates cannot prove historical ownership. */
export function organizationActivityOwnershipPredicateCreate(realmId: string, organizationId: string) {
  const event = storageEventTable
  return or(
    and(
      eq(event.aggregateType, "organization"),
      eq(event.aggregateId, organizationId),
      inArray(event.eventType, [
        organizationEventTypes.created,
        organizationEventTypes.updated,
        organizationEventTypes.statusChanged,
      ]),
    ),
    and(
      eq(event.aggregateType, "organization_invitation"),
      inArray(event.eventType, [
        organizationEventTypes.invitationCreated,
        organizationEventTypes.invitationAccepted,
        organizationEventTypes.invitationDeclined,
        organizationEventTypes.invitationExpired,
        organizationEventTypes.invitationRevoked,
      ]),
      sql`exists (select 1 from ${organizationInvitationTable} where ${organizationInvitationTable.id} = ${event.aggregateId} and ${organizationInvitationTable.realmId} = ${realmId} and ${organizationInvitationTable.organizationId} = ${organizationId})`,
    ),
    and(
      eq(event.aggregateType, "organization_membership"),
      inArray(event.eventType, [
        organizationEventTypes.membershipAdded,
        organizationEventTypes.membershipUpdated,
        organizationEventTypes.membershipRemoved,
      ]),
      sql`exists (select 1 from ${organizationMembershipTable} where ${organizationMembershipTable.id} = ${event.aggregateId} and ${organizationMembershipTable.realmId} = ${realmId} and ${organizationMembershipTable.organizationId} = ${organizationId})`,
    ),
    and(
      eq(event.aggregateType, "project"),
      eq(event.eventType, "project.created"),
      projectActivityOwnershipPredicateCreate(realmId, organizationId),
      sql`json_valid(${event.payload}) and json_type(${event.payload}, '$.name') = 'text' and json_type(${event.payload}, '$.authorizationRequired') in ('true', 'false') and json_type(${event.payload}, '$.projectAccessRequired') in ('true', 'false') and json_type(${event.payload}, '$.organizationId') = 'text' and json_extract(${event.payload}, '$.organizationId') = ${organizationId}`,
    ),
  )!
}
