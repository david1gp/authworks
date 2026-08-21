import type { JSX } from "solid-js"
import { Show } from "solid-js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { ImpersonationAdminStatus } from "./impersonationAdminStatusSchema.js"

/** Renders the shared loading, error, denied, assurance, and nested-rejected states. */
export function ImpersonationAdminStateBoundary(props: {
  readonly children: JSX.Element
  readonly error?: string
  readonly onRetry: () => void
  readonly status: ImpersonationAdminStatus
}) {
  const detail = () => {
    if (props.status === "permission-denied") return messageTranslate("admin.impersonation.permissionDenied")
    if (props.status === "assurance-required") return messageTranslate("admin.impersonation.assuranceRequired")
    if (props.status === "nested-rejected") return messageTranslate("admin.impersonation.nestedRejected")
    return props.error
  }
  const panelState = () => {
    if (props.status === "loading") return "loading" as const
    if (
      props.status === "permission-denied" ||
      props.status === "assurance-required" ||
      props.status === "nested-rejected"
    )
      return "inaccessible" as const
    return "error" as const
  }
  const title = () => {
    if (props.status === "permission-denied") return messageTranslate("admin.impersonation.permissionDeniedTitle")
    if (props.status === "assurance-required") return messageTranslate("admin.impersonation.assuranceRequiredTitle")
    if (props.status === "nested-rejected") return messageTranslate("admin.impersonation.nestedRejectedTitle")
    return undefined
  }

  return (
    <Show
      when={props.status === "ready"}
      fallback={
        <ProductionStatePanel
          detail={detail()}
          onRetry={props.status === "error" ? props.onRetry : undefined}
          state={panelState()}
          title={title()}
        />
      }
    >
      {props.children}
    </Show>
  )
}
