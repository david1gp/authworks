import type { InstanceTenantContext } from "./instanceTenantContext.js"

export function instanceTenantContextCreate(instanceId: string, actorId: string): InstanceTenantContext {
  return { actorId, instanceId, kind: "tenant" }
}
