import { A } from "@solidjs/router"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"

type StateOption = { href: string; label: string; selected: boolean }

export function DemoFixtureStateSelector(props: { options: readonly StateOption[] }) {
  return (
    <nav aria-label={messageTranslate("demo.fixture.state")} class="flex flex-wrap items-center gap-1.5">
      {props.options.map((option) => (
        <A
          aria-current={option.selected ? "page" : undefined}
          class={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
            option.selected
              ? "border-accent/40 bg-accent-soft text-accent"
              : "border-line bg-surface text-muted-foreground hover:border-line-strong hover:text-foreground"
          }`}
          href={option.href}
        >
          {option.label}
        </A>
      ))}
    </nav>
  )
}
