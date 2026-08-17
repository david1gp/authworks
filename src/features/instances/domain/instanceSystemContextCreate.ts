import type { InstanceSystemContext } from "./instanceSystemContext.js"

export function instanceSystemContextCreate(actorId = "system"): InstanceSystemContext {
  return { actorId, kind: "system" }
}
