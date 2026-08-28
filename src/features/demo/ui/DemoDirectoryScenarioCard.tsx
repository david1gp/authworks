import { A } from "@solidjs/router"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ttc } from "../../../ui/i18n/model/ttc.js"
import type { DemoFixtureScenario } from "../demoFixtureScenarioSchema.js"
import { demoFixtureStateLabel } from "../demoFixtureStateLabel.js"

export function DemoDirectoryScenarioCard(props: { scenario: DemoFixtureScenario }) {
  return (
    <article class="flex flex-col rounded-panel border border-line bg-surface p-3 transition-colors hover:border-line-strong">
      <div class="flex items-start justify-between gap-2">
        <AuthenticatedStatus
          label={
            props.scenario.availability === "available"
              ? messageTranslate("demo.directory.available")
              : messageTranslate("demo.directory.planned")
          }
          tone={props.scenario.availability === "available" ? "success" : "neutral"}
        />
        <span class="truncate font-mono text-2xs text-muted-foreground">
          {props.scenario.path.replace(/^\/demo\//, "/")}
        </span>
      </div>
      <h3 class="mt-2 text-sm font-semibold tracking-tight">
        <A class="hover:text-accent" href={props.scenario.path}>
          {ttc(props.scenario.title)}
        </A>
      </h3>
      <p class="mt-1 flex-1 text-xs text-muted-foreground">{ttc(props.scenario.description)}</p>
      <div class="mt-2.5 border-t border-line-subtle pt-2">
        <p class="mb-1.5 text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {messageTranslate("demo.directory.fixtureStates")}
        </p>
        <div class="flex flex-wrap gap-1">
          {props.scenario.states.map((fixtureState) => (
            <span class="rounded-control bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground">
              {demoFixtureStateLabel(fixtureState)}
            </span>
          ))}
        </div>
      </div>
      <A class="mt-2.5 text-xs font-medium text-accent hover:text-accent-hover" href={props.scenario.path}>
        {props.scenario.availability === "available"
          ? messageTranslate("demo.directory.openDemo")
          : messageTranslate("demo.directory.previewFoundation")}
      </A>
    </article>
  )
}
