import { ttc } from "../../../ui/i18n/model/ttc.js"
import type { DemoFixtureScenarioGroup } from "../demoFixtureScenarioGroupSchema.js"
import { DemoDirectoryScenarioCard } from "./DemoDirectoryScenarioCard.js"

export function DemoDirectoryGroup(props: { group: DemoFixtureScenarioGroup }) {
  return (
    <section aria-labelledby={`demo-group-${props.group.key}`}>
      <div class="mb-2.5 max-w-3xl">
        <h2 id={`demo-group-${props.group.key}`} class="text-sm font-semibold tracking-tight">
          {ttc(props.group.title)}
        </h2>
        <p class="mt-0.5 text-xs text-muted-foreground">{ttc(props.group.description)}</p>
      </div>
      <div class="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {props.group.scenarios.map((scenario) => (
          <DemoDirectoryScenarioCard scenario={scenario} />
        ))}
      </div>
    </section>
  )
}
