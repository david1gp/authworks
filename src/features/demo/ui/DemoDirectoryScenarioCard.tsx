import { mdiArrowRight } from "@adaptive-ds/mdi/mdiArrowRight.js"
import { A } from "@solidjs/router"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ttc } from "../../../ui/i18n/model/ttc.js"
import type { DemoFixtureScenario } from "../demoFixtureScenarioSchema.js"
import { demoFixtureStateLabel } from "../demoFixtureStateLabel.js"

export function DemoDirectoryScenarioCard(props: { scenario: DemoFixtureScenario }) {
  return (
    <article class="flex flex-col rounded-panel border border-line bg-surface p-5 shadow-panel transition-colors hover:border-line-strong">
      <div class="flex min-w-0 items-center justify-between gap-2">
        <AuthenticatedStatus
          class="shrink-0"
          label={
            props.scenario.availability === "available"
              ? messageTranslate("demo.directory.available")
              : messageTranslate("demo.directory.planned")
          }
          tone={props.scenario.availability === "available" ? "success" : "neutral"}
        />
        {/* A flex item defaults to `min-width: auto`, so the un-wrapping path would widen the whole page. */}
        <span
          class="min-w-0 truncate font-mono text-[0.8125rem] text-muted-foreground"
          title={props.scenario.path.replace(/^\/demo\//, "/")}
        >
          {props.scenario.path.replace(/^\/demo\//, "/")}
        </span>
      </div>
      <h3 class="mt-3 text-[0.9375rem] font-semibold tracking-tight">
        <A class="hover:text-accent" href={props.scenario.path}>
          {ttc(props.scenario.title)}
        </A>
      </h3>
      <p class="mt-1.5 flex-1 text-sm text-muted-foreground">{ttc(props.scenario.description)}</p>
      <div class="mt-4 border-t border-line-subtle pt-3">
        <p class="mb-2 text-xs font-medium text-muted-foreground">{messageTranslate("demo.directory.fixtureStates")}</p>
        <div class="flex flex-wrap gap-1.5">
          {props.scenario.states.map((fixtureState) => (
            <span class="rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {demoFixtureStateLabel(fixtureState)}
            </span>
          ))}
        </div>
      </div>
      <A
        class="mt-4 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-accent hover:text-accent-hover"
        href={props.scenario.path}
      >
        {props.scenario.availability === "available"
          ? messageTranslate("demo.directory.openDemo")
          : messageTranslate("demo.directory.previewFoundation")}
        <Icon class="size-4 shrink-0 transition-transform rtl:rotate-180" path={mdiArrowRight} />
      </A>
    </article>
  )
}
