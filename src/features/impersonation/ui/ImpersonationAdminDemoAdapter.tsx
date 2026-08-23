import { ConfirmDialog } from "../../../ui/confirm/ConfirmDialog.js"
import { DemoFixtureStateSelector } from "../../demo/ui/DemoFixtureStateSelector.js"
import { ImpersonationAdminView } from "./ImpersonationAdminView.js"
import { impersonationAdminDemoStateCreate } from "./impersonationAdminDemoStateCreate.js"

export function ImpersonationAdminDemoAdapter() {
  const state = impersonationAdminDemoStateCreate()
  return (
    <div class="mx-auto grid min-w-0 max-w-6xl gap-6">
      <DemoFixtureStateSelector options={state.stateOptions()} />
      <ImpersonationAdminView basePath="/demo/admin" state={state} />
      <ConfirmDialog state={state.confirmState} titleKey="admin.common.confirmTitle" />
    </div>
  )
}
