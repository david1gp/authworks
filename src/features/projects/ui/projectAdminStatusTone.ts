import type { AuthenticatedStatusTone } from "../../../ui/authenticated/authenticatedStatusTone.js"
import type { ProjectStatus } from "../public/projectStatusSchema.js"

const tones = { active: "success", inactive: "warning", removed: "danger" } as const satisfies Record<
  ProjectStatus,
  AuthenticatedStatusTone
>

/** Maps a project, application, or grant lifecycle status onto the shared authenticated status tone. */
export function projectAdminStatusTone(status: ProjectStatus): AuthenticatedStatusTone {
  return tones[status]
}
