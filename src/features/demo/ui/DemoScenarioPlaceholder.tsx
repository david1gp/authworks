import { Match, Show, Switch } from "solid-js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { DemoFixtureScenarioGroup } from "../demoFixtureScenarioGroupSchema.js"
import { demoScenarioPlaceholderStateCreate } from "./demoScenarioPlaceholderStateCreate.js"

export function DemoScenarioPlaceholder(props: { backHref: string; groups: readonly DemoFixtureScenarioGroup[] }) {
  const state = demoScenarioPlaceholderStateCreate(() => props.groups)
  return (
    <div class="mx-auto grid w-full max-w-5xl gap-5">
      <Show
        when={state.scenario()}
        fallback={
          <AuthenticatedSection padded>
            <ProductionStatePanel
              compact
              detail={messageTranslate("demo.placeholder.notFoundDescription")}
              state="empty"
              title={messageTranslate("demo.placeholder.notFoundTitle")}
            />
          </AuthenticatedSection>
        }
      >
        <AuthenticatedSection padded>
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
      </Show>
    </div>
  )
}
