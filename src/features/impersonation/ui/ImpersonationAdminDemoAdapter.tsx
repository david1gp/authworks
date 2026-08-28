import { AuthenticatedPageHeader } from "../../../ui/authenticated/AuthenticatedPageHeader.js"
import { ConfirmDialog } from "../../../ui/confirm/ConfirmDialog.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { DemoFixtureStateSelector } from "../../demo/ui/DemoFixtureStateSelector.js"
import { ImpersonationAdminView } from "./ImpersonationAdminView.js"
import { impersonationAdminDemoStateCreate } from "./impersonationAdminDemoStateCreate.js"

export function ImpersonationAdminDemoAdapter() {
  const state = impersonationAdminDemoStateCreate()
  return (
    <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
      <AuthenticatedPageHeader
        description={messageTranslate("admin.impersonation.description")}
        eyebrow={messageTranslate("demo.fixture.preview")}
        meta={
          <>
            <span class="text-2xs font-semibold uppercase tracking-[0.12em]">
              {messageTranslate("demo.fixture.state")}
            </span>
            <DemoFixtureStateSelector options={state.stateOptions()} />
          </>
        }
        title={messageTranslate("admin.impersonation.title")}
      />
      <ImpersonationAdminView basePath="/demo/admin" state={state} />
      <ConfirmDialog state={state.confirmState} titleKey="admin.common.confirmTitle" />
    </div>
  )
}
