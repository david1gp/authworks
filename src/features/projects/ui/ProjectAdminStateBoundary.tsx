import type { JSX } from "solid-js"
import { Show } from "solid-js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { ProjectAdminStatus } from "./projectAdminStatusSchema.js"

/** Renders the shared loading, empty, error, denied, and cross-tenant states. */
export function ProjectAdminStateBoundary(props: {
  readonly children: JSX.Element
  readonly emptyDetail: string
  readonly error?: string
  readonly onRetry: () => void
  readonly status: ProjectAdminStatus
}) {
  const detail = () => {
    if (props.status === "empty") return props.emptyDetail
    if (props.status === "permission-denied") return messageTranslate("admin.projects.permissionDenied")
    if (props.status === "cross-tenant") return messageTranslate("admin.projects.crossTenant")
    return props.error
  }
  const panelState = () => {
    if (props.status === "loading") return "loading" as const
    if (props.status === "empty") return "empty" as const
    if (props.status === "permission-denied" || props.status === "cross-tenant") return "inaccessible" as const
    return "error" as const
  }

  return (
    <Show
      when={props.status === "ready"}
      fallback={
        <ProductionStatePanel
          detail={detail()}
          onRetry={props.status === "error" ? props.onRetry : undefined}
          state={panelState()}
        />
      }
    >
      {props.children}
    </Show>
  )
}
