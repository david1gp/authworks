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
        "rounded-panel border px-3 py-2 text-xs font-medium",
        props.tone === "danger"
          ? "border-danger/35 bg-danger-soft text-danger"
          : "border-success/35 bg-success-soft text-success",
        props.class,
      )}
      role={props.tone === "danger" ? "alert" : "status"}
    >
      {props.message}
    </p>
  )
}
