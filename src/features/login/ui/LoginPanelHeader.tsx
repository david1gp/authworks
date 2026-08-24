import { Show } from "solid-js"

export function LoginPanelHeader(props: {
  readonly description?: string
  readonly headingId?: string
  readonly headingRegister?: (element: HTMLHeadingElement) => void
  readonly headingTabIndex?: number
  readonly title: string
}) {
  return (
    <>
      <h1
        class="text-balance text-2xl font-semibold tracking-tight"
        id={props.headingId}
        ref={(element) => props.headingRegister?.(element)}
        tabindex={props.headingTabIndex ?? -1}
      >
        {props.title}
      </h1>
      <Show when={props.description}>
        {(description) => <p class="mt-2 text-pretty leading-6 text-muted-foreground">{description()}</p>}
      </Show>
    </>
  )
}
