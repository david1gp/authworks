import { Show } from "solid-js"

export function LoginPanelHeader(props: { readonly description?: string; readonly title: string }) {
  return (
    <>
      <h1 class="text-balance text-2xl font-semibold tracking-tight">{props.title}</h1>
      <Show when={props.description}>
        {(description) => <p class="mt-2 text-pretty leading-6 text-muted-foreground">{description()}</p>}
      </Show>
    </>
  )
}
