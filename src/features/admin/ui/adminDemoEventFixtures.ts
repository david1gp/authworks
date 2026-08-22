import { demoAdminImpersonationSession } from "../../demo/demoAdminImpersonationSession.js"
import { demoAdminRedactedEvent } from "../../demo/demoAdminRedactedEvent.js"
import type { Event as TenantEvent } from "../../events/public/eventSchema.js"

const fixtureNow = Date.UTC(2026, 7, 21, 9, 30)
const realmId = "01900000-0000-7000-8000-000000000001"

export const adminDemoEventFixtures: readonly TenantEvent[] = [
  {
    actorId: demoAdminImpersonationSession.actorId,
    aggregateId: demoAdminImpersonationSession.sessionId,
    aggregateType: "impersonation",
    aggregateVersion: 2,
    correlationId: "01900000-0000-7000-8000-0000000000c5",
    eventType: "impersonation.ended",
    id: "01900000-0000-7000-8000-0000000000d5",
    metadata: { auditSafe: true, source: "impersonation" },
    occurredAt: demoAdminImpersonationSession.startedAt + 300_000,
    payload: {
      reason: "impersonation_ended",
      sessionId: demoAdminImpersonationSession.sessionId,
    },
    realmId,
  },
  {
    actorId: demoAdminImpersonationSession.actorId,
    aggregateId: demoAdminImpersonationSession.sessionId,
    aggregateType: "impersonation",
    aggregateVersion: 1,
    correlationId: "01900000-0000-7000-8000-0000000000c4",
    eventType: "impersonation.started",
    id: "01900000-0000-7000-8000-0000000000d4",
    metadata: { auditSafe: true, source: "impersonation" },
    occurredAt: demoAdminImpersonationSession.startedAt,
    payload: {
      durationMs: demoAdminImpersonationSession.expiresAt - demoAdminImpersonationSession.startedAt,
      reason: demoAdminImpersonationSession.reason,
      sessionId: demoAdminImpersonationSession.sessionId,
      targetUserId: demoAdminImpersonationSession.subjectId,
    },
    realmId,
  },
  // A payload carrying real secret-shaped fields, so the view proves it redacts before rendering.
  demoAdminRedactedEvent,
  {
    actorId: "01900000-0000-7000-8000-0000000000b1",
    aggregateId: "01900000-0000-7000-8000-000000000021",
    aggregateType: "user",
    aggregateVersion: 4,
    correlationId: "01900000-0000-7000-8000-0000000000c1",
    eventType: "user.lifecycle.changed",
    id: "01900000-0000-7000-8000-0000000000d1",
    metadata: { source: "admin" },
    occurredAt: fixtureNow - 3_600_000,
    payload: { previousState: "initial", state: "active" },
    realmId,
  },
  {
    aggregateId: "01900000-0000-7000-8000-000000000011",
    aggregateType: "organization",
    aggregateVersion: 1,
    correlationId: "01900000-0000-7000-8000-0000000000c2",
    eventType: "organization.created",
    id: "01900000-0000-7000-8000-0000000000d2",
    metadata: { source: "system" },
    occurredAt: fixtureNow - 86_400_000,
    payload: { name: "Northwind Labs" },
    realmId,
  },
  {
    actorId: "01900000-0000-7000-8000-0000000000b1",
    aggregateId: realmId,
    aggregateType: "realm",
    aggregateVersion: 7,
    correlationId: "01900000-0000-7000-8000-0000000000c3",
    eventType: "realm.updated",
    id: "01900000-0000-7000-8000-0000000000d3",
    metadata: { source: "admin" },
    occurredAt: fixtureNow - 172_800_000,
    // Secret values are redacted before an event is stored, so fixtures show the redaction marker.
    payload: { name: "Northwind customer identity", secret: "[redacted]" },
    realmId,
  },
]
