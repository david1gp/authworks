import { A } from "@solidjs/router"
import { For } from "solid-js"
import { BlueBulletPoint } from "#ui/static/lists/BlueBulletPoint.jsx"
import { ttc } from "../../../ui/i18n/model/ttc.js"
import type { DemoFixtureScenarioGroup } from "../demoFixtureScenarioGroupSchema.js"

export function DemoDirectoryGroup(props: { group: DemoFixtureScenarioGroup }) {
  return (
    <section aria-labelledby={`demo-group-${props.group.key}`} class="min-w-0">
      <h2 id={`demo-group-${props.group.key}`} class="text-xl font-semibold">
        {ttc(props.group.title)}
      </h2>
      <div class="flex flex-col">
        <For each={props.group.scenarios}>
          {(scenario) => (
            <div class="flex flex-row flex-nowrap content-center">
              <BlueBulletPoint />
              <A class="break-all no-underline hover:underline" href={scenario.path}>
                {ttc(scenario.title)}
              </A>
            </div>
          )}
        </For>
      </div>
    </section>
  )
}
