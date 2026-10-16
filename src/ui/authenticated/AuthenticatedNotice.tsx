import { mdiAlertCircleOutline } from "@adaptive-ds/mdi/mdiAlertCircleOutline.js"
import { mdiCheckCircleOutline } from "@adaptive-ds/mdi/mdiCheckCircleOutline.js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { classMerge } from "#ui/utils/classMerge.js"

/**
 * Single-line outcome message for an authenticated page. Success uses the polite status role so a
 * saved change is announced without interrupting, while danger asserts through the alert role.
 */
export function AuthenticatedNotice(props: {
  readonly class?: string
  readonly message: string
  readonly tone?: "danger" | "success"
}) {
  return (
    <p
      class={classMerge(
        "flex items-start gap-2.5 rounded-control border px-3.5 py-3 text-sm",
        props.tone === "danger"
          ? "border-danger/35 bg-danger-soft text-danger"
          : "border-success/35 bg-success-soft text-success",
        props.class,
      )}
      role={props.tone === "danger" ? "alert" : "status"}
    >
      <Icon
        aria-hidden="true"
        class="mt-0.5 size-4.5"
        path={props.tone === "danger" ? mdiAlertCircleOutline : mdiCheckCircleOutline}
      />
      {props.message}
    </p>
  )
}
