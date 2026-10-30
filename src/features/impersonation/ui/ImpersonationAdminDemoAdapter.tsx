import { ConfirmDialog } from "../../../ui/confirm/ConfirmDialog.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ImpersonationAdminView } from "./ImpersonationAdminView.js"
import { impersonationAdminDemoStateCreate } from "./impersonationAdminDemoStateCreate.js"

export function ImpersonationAdminDemoAdapter() {
  const state = impersonationAdminDemoStateCreate()
  return (
    <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
      <h1 class="sr-only">{messageTranslate("admin.impersonation.title")}</h1>
      <ImpersonationAdminView basePath="/demo/admin" state={state} />
      <ConfirmDialog state={state.confirmState} titleKey="admin.common.confirmTitle" />
    </div>
  )
}
