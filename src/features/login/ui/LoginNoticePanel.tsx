import { mdiAlertCircleOutline } from "@adaptive-ds/mdi/mdiAlertCircleOutline.js"
import { mdiCheckCircleOutline } from "@adaptive-ds/mdi/mdiCheckCircleOutline.js"
import { mdiEmailFastOutline } from "@adaptive-ds/mdi/mdiEmailFastOutline.js"
import { Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { LoginPanelHeader } from "./LoginPanelHeader.js"

const noticeIcons = {
  error: mdiAlertCircleOutline,
  pending: mdiEmailFastOutline,
  success: mdiCheckCircleOutline,
} as const

/** Terminal login outcome such as recovery sent, reset complete, signed out, or unavailable. */
export function LoginNoticePanel(props: {
  readonly actionLabel?: string
  readonly description: string
  readonly kind: keyof typeof noticeIcons
  readonly onAction?: () => void
  readonly title: string
}) {
  return (
    <section>
      <span
        class={`mb-5 grid size-12 place-items-center rounded-xl ${
          props.kind === "error" ? "bg-danger/10 text-danger" : "bg-accent/10 text-accent"
        }`}
      >
        <Icon path={noticeIcons[props.kind]} />
      </span>
      <div role={props.kind === "error" ? "alert" : "status"}>
        <LoginPanelHeader description={props.description} title={props.title} />
      </div>
      <Show when={props.onAction !== undefined && props.actionLabel !== undefined}>
        <Button class="mt-6 w-full" onClick={props.onAction} type="button" variant="filledBlue">
          {props.actionLabel}
        </Button>
      </Show>
    </section>
  )
}
