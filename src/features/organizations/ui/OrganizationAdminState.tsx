import type { JSX } from "solid-js"
import { Show } from "solid-js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { OrganizationAdminStatus } from "./organizationAdminStatusSchema.js"

/** Renders the shared loading, empty, error, denied, and assurance states for administration pages. */
export function OrganizationAdminState(props: {
  readonly children: JSX.Element
  readonly emptyDetail: string
  readonly error?: string
  readonly onRetry: () => void
  readonly status: OrganizationAdminStatus
}) {
  return (
    <Show
      when={props.status === "ready"}
      fallback={
        <ProductionStatePanel
          detail={
            props.status === "empty"
              ? props.emptyDetail
              : props.status === "permission-denied"
                ? messageTranslate("admin.organizations.permissionDenied")
                : props.status === "assurance-required"
                  ? messageTranslate("admin.organizations.assuranceRequired")
                  : props.error
          }
          onRetry={props.status === "error" ? props.onRetry : undefined}
          state={
            props.status === "loading"
              ? "loading"
              : props.status === "empty"
                ? "empty"
                : props.status === "permission-denied" || props.status === "assurance-required"
                  ? "inaccessible"
                  : "error"
          }
          title={
            props.status === "permission-denied"
              ? messageTranslate("admin.organizations.permissionDeniedTitle")
              : props.status === "assurance-required"
                ? messageTranslate("admin.organizations.assuranceRequiredTitle")
                : undefined
          }
        />
      }
    >
      {props.children}
    </Show>
  )
}
