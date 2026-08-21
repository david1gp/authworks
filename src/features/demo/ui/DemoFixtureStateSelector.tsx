import { A } from "@solidjs/router"
import { ttc } from "../../../ui/i18n/model/ttc.js"

type StateOption = { href: string; label: string; selected: boolean }

export function DemoFixtureStateSelector(props: { options: readonly StateOption[] }) {
  return (
    <nav aria-label={ttc("Fixture state")} class="flex flex-wrap gap-2">
      {props.options.map((option) => (
        <A
          aria-current={option.selected ? "page" : undefined}
          class={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
            option.selected
              ? "border-accent bg-accent text-accent-contrast"
              : "border-line bg-surface hover:border-blue-300 hover:bg-surface-hover"
          }`}
          href={option.href}
        >
          {ttc(option.label)}
        </A>
      ))}
    </nav>
  )
}
