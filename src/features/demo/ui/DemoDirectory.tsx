import type { DemoFixtureScenarioGroup } from "../demoFixtureScenarioGroupSchema.js"
import { DemoDirectoryGroup } from "./DemoDirectoryGroup.js"

type DemoDirectoryProps = {
  groups: readonly DemoFixtureScenarioGroup[]
}

export function DemoDirectory(props: DemoDirectoryProps) {
  return (
    <div class="mx-auto grid w-full max-w-7xl gap-6">
      <div class="grid gap-8">
        {props.groups.map((group) => (
          <DemoDirectoryGroup group={group} />
        ))}
      </div>
    </div>
  )
}
