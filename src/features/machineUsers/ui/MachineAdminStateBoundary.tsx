import type { JSX } from "solid-js"
import { Show } from "solid-js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { MachineAdminStatus } from "./machineAdminStatusSchema.js"

/** Renders the shared loading, empty, error, denied, assurance, and cross-tenant states. */
export function MachineAdminStateBoundary(props: {
  readonly children: JSX.Element
  readonly emptyDetail: string
  readonly error?: string
  readonly onRetry: () => void
  readonly status: MachineAdminStatus
}) {
  const detail = () => {
    if (props.status === "empty") return props.emptyDetail
    if (props.status === "permission-denied") return messageTranslate("admin.machine.permissionDenied")
    if (props.status === "assurance-required") return messageTranslate("admin.machine.assuranceRequired")
    if (props.status === "cross-tenant") return messageTranslate("admin.machine.crossTenant")
    return props.error
  }
  const panelState = () => {
    if (props.status === "loading") return "loading" as const
    if (props.status === "empty") return "empty" as const
    if (
      props.status === "permission-denied" ||
      props.status === "assurance-required" ||
      props.status === "cross-tenant"
    )
      return "inaccessible" as const
    return "error" as const
  }
  const title = () => {
    if (props.status === "permission-denied") return messageTranslate("admin.machine.permissionDeniedTitle")
    if (props.status === "assurance-required") return messageTranslate("admin.machine.assuranceRequiredTitle")
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
