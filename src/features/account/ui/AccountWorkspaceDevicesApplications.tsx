import type { JSX } from "solid-js"

export function AccountWorkspaceDevicesApplications(props: {
  readonly activity: JSX.Element
  readonly applications: JSX.Element
  readonly sessions: JSX.Element
}) {
  return (
    <div class="grid min-w-0 items-start gap-3 lg:grid-cols-2 [&>*]:min-w-0">
      <div class="min-w-0">{props.activity}</div>
      <div class="min-w-0">{props.sessions}</div>
      <div class="min-w-0 lg:col-span-2">{props.applications}</div>
    </div>
  )
}
