import { AuthenticatedPageHeader } from "../../../ui/authenticated/AuthenticatedPageHeader.js"
import { ConfirmDialog } from "../../../ui/confirm/ConfirmDialog.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { DemoFixtureStateSelector } from "../../demo/ui/DemoFixtureStateSelector.js"
import { AdminScreenView } from "./AdminScreenView.js"
import { adminDemoStateCreate } from "./adminDemoStateCreate.js"
import type { AdminScreen } from "./adminScreenSchema.js"

export function AdminDemoAdapter(props: { readonly screen: AdminScreen }) {
  const state = adminDemoStateCreate(() => props.screen)
  return (
    <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
      <AuthenticatedPageHeader
        description={state.scenarioDescription()}
        eyebrow={messageTranslate("demo.fixture.preview")}
        meta={
          <>
            <span class="text-2xs font-semibold uppercase tracking-[0.12em]">
              {messageTranslate("demo.fixture.state")}
            </span>
            <DemoFixtureStateSelector options={state.stateOptions()} />
          </>
        }
        title={state.scenarioTitle()}
      />
      <AdminScreenView basePath="/demo/admin" screen={props.screen} state={state} />
      <ConfirmDialog state={state.confirmState} titleKey="admin.common.confirmTitle" />
    </div>
  )
}
