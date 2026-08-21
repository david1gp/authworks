import { A } from "@solidjs/router"
import { ttc } from "../../../ui/i18n/model/ttc.js"
import type { DemoFixtureScenario } from "../demoFixtureScenarioSchema.js"

export function DemoDirectoryScenarioCard(props: { scenario: DemoFixtureScenario }) {
  return (
    <article class="group flex min-h-56 flex-col rounded-2xl border border-line bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:hover:border-blue-800">
      <div class="flex items-start justify-between gap-3">
        <span
          class={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            props.scenario.availability === "available"
              ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {ttc(props.scenario.availability === "available" ? "Available" : "Planned")}
        </span>
        <span class="font-mono text-xs text-muted-foreground">{props.scenario.path.replace(/^\/demo\//, "/")}</span>
      </div>
      <h3 class="mt-4 text-lg font-semibold">
        <A class="hover:text-accent" href={props.scenario.path}>
          {ttc(props.scenario.title)}
        </A>
      </h3>
      <p class="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{ttc(props.scenario.description)}</p>
      <div class="mt-5 border-t border-line-subtle pt-4">
        <p class="mb-2 text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground">
          {ttc("Fixture states")}
        </p>
        <div class="flex flex-wrap gap-1.5">
          {props.scenario.states.map((fixtureState) => (
            <span class="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{ttc(fixtureState)}</span>
          ))}
        </div>
      </div>
      <A
        class="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:text-accent-hover"
        href={props.scenario.path}
      >
        {ttc(props.scenario.availability === "available" ? "Open demo" : "Preview foundation")}
        <span aria-hidden="true" class="transition-transform group-hover:translate-x-1">
          →
        </span>
      </A>
    </article>
  )
}
