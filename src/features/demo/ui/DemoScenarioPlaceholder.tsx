import { A } from "@solidjs/router"
import { Match, Show, Switch } from "solid-js"
import { AuthenticatedPageHeader } from "../../../ui/authenticated/AuthenticatedPageHeader.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ttc } from "../../../ui/i18n/model/ttc.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { DemoFixtureScenarioGroup } from "../demoFixtureScenarioGroupSchema.js"
import { DemoFixtureStateSelector } from "./DemoFixtureStateSelector.js"
import { demoScenarioPlaceholderStateCreate } from "./demoScenarioPlaceholderStateCreate.js"

export function DemoScenarioPlaceholder(props: { backHref: string; groups: readonly DemoFixtureScenarioGroup[] }) {
  const state = demoScenarioPlaceholderStateCreate(() => props.groups)
  return (
    <div class="mx-auto grid w-full max-w-5xl gap-3">
      <A class="text-xs font-medium text-accent hover:underline" href={props.backHref}>
        {messageTranslate("demo.directory.back")}
      </A>
      <Show
        when={state.scenario()}
        fallback={
          <>
            <AuthenticatedPageHeader
              description={messageTranslate("demo.placeholder.notFoundDescription")}
              title={messageTranslate("demo.placeholder.notFoundTitle")}
            />
            <AuthenticatedSection>
              <ProductionStatePanel
                compact
                detail={messageTranslate("demo.placeholder.notFoundDescription")}
                state="empty"
                title={messageTranslate("demo.placeholder.notFoundTitle")}
              />
            </AuthenticatedSection>
          </>
        }
      >
        {(scenario) => (
          <>
            <AuthenticatedPageHeader
              description={ttc(scenario().description)}
              eyebrow={messageTranslate("demo.fixture.preview")}
              meta={
                <>
                  <AuthenticatedStatus label={scenario().path} tone="neutral" />
                  <DemoFixtureStateSelector options={state.stateOptions()} />
                </>
              }
              title={ttc(scenario().title)}
            />
            <AuthenticatedSection label={messageTranslate("demo.fixture.state")}>
              <Switch>
                <Match when={state.selectedState() === "loading"}>
                  <ProductionStatePanel compact state="loading" title={messageTranslate("demo.placeholder.loading")} />
                </Match>
                <Match when={state.selectedState() === "empty"}>
                  <ProductionStatePanel
                    compact
                    detail={messageTranslate("demo.placeholder.emptyDescription")}
                    state="empty"
                    title={messageTranslate("demo.placeholder.emptyTitle")}
                  />
                </Match>
                <Match when={state.selectedState() === "error"}>
                  <ProductionStatePanel
                    compact
                    detail={messageTranslate("demo.placeholder.errorDescription")}
                    state="error"
                    title={messageTranslate("demo.placeholder.errorTitle")}
                  />
                </Match>
                <Match when={state.selectedState() === "success"}>
                  <ProductionStatePanel
                    compact
                    detail={messageTranslate("demo.placeholder.readyDescription")}
                    state="empty"
                    title={messageTranslate("demo.placeholder.readyTitle")}
                  />
                </Match>
              </Switch>
            </AuthenticatedSection>
          </>
        )}
      </Show>
    </div>
  )
}
