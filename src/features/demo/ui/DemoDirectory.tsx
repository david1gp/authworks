import { AuthenticatedPageHeader } from "../../../ui/authenticated/AuthenticatedPageHeader.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ttc } from "../../../ui/i18n/model/ttc.js"
import type { DemoFixtureScenarioGroup } from "../demoFixtureScenarioGroupSchema.js"
import { DemoDirectoryGroup } from "./DemoDirectoryGroup.js"
import { demoDirectoryStateCreate } from "./demoDirectoryStateCreate.js"

type DemoDirectoryProps = {
  description: () => string
  eyebrow: () => string
  groups: readonly DemoFixtureScenarioGroup[]
  title: () => string
}

export function DemoDirectory(props: DemoDirectoryProps) {
  const state = demoDirectoryStateCreate(() => props.groups)
  return (
    <div class="mx-auto grid w-full max-w-7xl gap-4">
      <AuthenticatedPageHeader
        description={ttc(props.description())}
        eyebrow={ttc(props.eyebrow())}
        meta={
          <>
            <AuthenticatedStatus
              label={`${state.availableCount()} ${messageTranslate("demo.directory.availableDemos")}`}
              tone="success"
            />
            <AuthenticatedStatus
              label={`${state.plannedCount()} ${messageTranslate("demo.directory.plannedDestinations")}`}
              tone="neutral"
            />
          </>
        }
        title={ttc(props.title())}
      />
      <div class="grid gap-5">
        {props.groups.map((group) => (
          <DemoDirectoryGroup group={group} />
        ))}
      </div>
    </div>
  )
}
