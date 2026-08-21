import { A } from "@solidjs/router"
import { Match, Show, Switch } from "solid-js"
import { LoaderShuffle4Dots } from "#ui/static/loaders/LoaderShuffle4Dots.jsx"
import { ttc } from "../../../ui/i18n/model/ttc.js"
import type { DemoFixtureScenarioGroup } from "../demoFixtureScenarioGroupSchema.js"
import { DemoFixtureStateSelector } from "./DemoFixtureStateSelector.js"
import { demoScenarioPlaceholderStateCreate } from "./demoScenarioPlaceholderStateCreate.js"

export function DemoScenarioPlaceholder(props: { backHref: string; groups: readonly DemoFixtureScenarioGroup[] }) {
  const state = demoScenarioPlaceholderStateCreate(() => props.groups)
  return (
    <div class="mx-auto max-w-4xl py-4 sm:py-10">
      <A class="text-sm font-medium text-accent hover:underline" href={props.backHref}>
        ← {ttc("Back to directory")}
      </A>
      <Show
        when={state.scenario()}
        fallback={
          <section class="mt-6 rounded-2xl border border-line bg-surface p-8">
            <h1 class="text-2xl font-semibold">{ttc("Demo destination not found")}</h1>
            <p class="mt-2 text-muted-foreground">{ttc("Choose a supported destination from the directory.")}</p>
          </section>
        }
      >
        {(scenario) => (
          <>
            <header class="mt-6 rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <span class="rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {ttc("Stateless fixture preview")}
                </span>
                <code class="text-xs text-muted-foreground">{scenario().path}</code>
              </div>
              <h1 class="mt-5 text-3xl font-semibold tracking-tight">{ttc(scenario().title)}</h1>
              <p class="mt-3 max-w-2xl leading-7 text-muted-foreground">{ttc(scenario().description)}</p>
              <div class="mt-6">
                <p class="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {ttc("Fixture state")}
                </p>
                <DemoFixtureStateSelector options={state.stateOptions()} />
              </div>
            </header>
            <section class="mt-5 min-h-64 rounded-2xl border border-dashed border-line-strong bg-muted/40 p-8">
              <Switch>
                <Match when={state.selectedState() === "loading"}>
                  <div class="grid h-48 place-items-center text-center" role="status">
                    <div>
                      <LoaderShuffle4Dots />
                      <p class="mt-4 font-medium">{ttc("Loading fixture")}</p>
                    </div>
                  </div>
                </Match>
                <Match when={state.selectedState() === "empty"}>
                  <div class="grid h-48 place-items-center text-center">
                    <div>
                      <p class="text-3xl" aria-hidden="true">
                        ○
                      </p>
                      <h2 class="mt-3 text-xl font-semibold">{ttc("No fixture records")}</h2>
                      <p class="mt-2 text-sm text-muted-foreground">
                        {ttc("This destination is ready for an intentional empty state.")}
                      </p>
                    </div>
                  </div>
                </Match>
                <Match when={state.selectedState() === "error"}>
                  <div class="grid h-48 place-items-center text-center" role="alert">
                    <div>
                      <p class="text-3xl text-danger" aria-hidden="true">
                        !
                      </p>
                      <h2 class="mt-3 text-xl font-semibold">{ttc("Fixture error")}</h2>
                      <p class="mt-2 text-sm text-muted-foreground">
                        {ttc("A deterministic error can be presented here without a network request.")}
                      </p>
                    </div>
                  </div>
                </Match>
                <Match when={state.selectedState() === "success"}>
                  <div class="grid h-48 place-items-center text-center">
                    <div>
                      <p class="text-3xl text-success" aria-hidden="true">
                        ✓
                      </p>
                      <h2 class="mt-3 text-xl font-semibold">{ttc("Fixture contract ready")}</h2>
                      <p class="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                        {ttc(
                          "The route, supported states, and demo adapter boundary are defined. The feature page is intentionally not implemented in this increment.",
                        )}
                      </p>
                    </div>
                  </div>
                </Match>
              </Switch>
            </section>
          </>
        )}
      </Show>
    </div>
  )
}
