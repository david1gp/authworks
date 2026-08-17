import type { OrganizationContext } from "./organizationContext.js"

export function organizationContextCreate(
  instanceId: string,
  organizationId: string,
  actorId: string,
): OrganizationContext {
  return { actorId, instanceId, kind: "organization", organizationId }
}
