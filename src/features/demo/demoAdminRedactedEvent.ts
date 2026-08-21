import type { Event } from "../events/public/eventSchema.js"
import { demoRealmId } from "./demoRealmId.js"

/** A fixture event whose payload proves secret values are never rendered in administration. */
export const demoAdminRedactedEvent: Event = {
  actorId: "01900000-0000-7000-8000-000000000021",
  aggregateId: "01900000-0000-7000-8000-000000000041",
  aggregateType: "oidc_client",
  aggregateVersion: 3,
  correlationId: "01900000-0000-7000-8000-000000000054",
  eventType: "oidc.client.secret.rotated",
  id: "01900000-0000-7000-8000-000000000054",
  metadata: { source: "demo" },
  occurredAt: 1_755_800_000_000,
  payload: {
    clientId: "analytics-dashboard",
    clientSecret: "never-rendered",
    rotatedBy: "01900000-0000-7000-8000-000000000021",
    secretHash: "never-rendered",
  },
  realmId: demoRealmId,
}
