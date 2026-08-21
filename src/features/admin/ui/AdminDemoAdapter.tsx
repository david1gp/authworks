import { ttc } from "../../../ui/i18n/model/ttc.js"
import { DemoFixtureStateSelector } from "../../demo/ui/DemoFixtureStateSelector.js"
import { AdminScreenView } from "./AdminScreenView.js"
import { adminDemoStateCreate } from "./adminDemoStateCreate.js"
import type { AdminScreen } from "./adminScreenSchema.js"

export function AdminDemoAdapter(props: { readonly screen: AdminScreen }) {
  const state = adminDemoStateCreate(() => props.screen)
  return (
    <div class="mx-auto grid min-w-0 max-w-6xl gap-6 [&>*]:min-w-0">
      <header class="rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <span class="rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {ttc("Stateless fixture preview")}
        </span>
        <h1 class="mt-5 text-3xl font-semibold tracking-tight">{ttc(state.scenario()?.title ?? "Administration")}</h1>
        <p class="mt-3 max-w-2xl leading-7 text-muted-foreground">
          {ttc(state.scenario()?.description ?? "Realm administration")}
        </p>
        <div class="mt-6">
          <p class="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{ttc("Fixture state")}</p>
          <DemoFixtureStateSelector options={state.stateOptions()} />
        </div>
      </header>
      <AdminScreenView basePath="/demo/admin" screen={props.screen} state={state} />
    </div>
  )
}
