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
    <div class="mx-auto w-full max-w-7xl">
      <header class="relative overflow-hidden rounded-3xl border border-blue-200/70 bg-gradient-to-br from-blue-50 via-surface to-indigo-50 px-6 py-9 shadow-sm dark:border-blue-900/60 dark:from-blue-950/35 dark:via-surface dark:to-indigo-950/25 sm:px-10 sm:py-12">
        <div class="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-300/20 blur-3xl dark:bg-blue-500/10" />
        <div class="relative max-w-3xl">
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-accent">{ttc(props.eyebrow())}</p>
          <h1 class="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl break-words">{ttc(props.title())}</h1>
          <p class="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">{ttc(props.description())}</p>
          <div class="mt-6 flex flex-wrap gap-2 text-sm">
            <span class="rounded-full border border-green-300 bg-green-50 px-3 py-1.5 font-medium text-green-800 dark:border-green-900 dark:bg-green-950/60 dark:text-green-200">
              {state.availableCount()} {messageTranslate("demo.directory.availableDemos")}
            </span>
            <span class="rounded-full border border-line bg-surface/80 px-3 py-1.5 font-medium text-muted-foreground">
              {state.plannedCount()} {messageTranslate("demo.directory.plannedDestinations")}
            </span>
          </div>
        </div>
      </header>

      <div class="mt-10 grid gap-10">
        {props.groups.map((group) => (
          <DemoDirectoryGroup group={group} />
        ))}
      </div>
    </div>
  )
}
