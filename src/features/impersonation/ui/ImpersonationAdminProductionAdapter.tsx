import { ConfirmDialog } from "../../../ui/confirm/ConfirmDialog.js"
import { ImpersonationAdminView } from "./ImpersonationAdminView.js"
import { impersonationAdminProductionStateCreate } from "./impersonationAdminProductionStateCreate.js"

export function ImpersonationAdminProductionAdapter() {
  const state = impersonationAdminProductionStateCreate()
  return (
    <>
      <ImpersonationAdminView basePath="/admin" state={state} />
      <ConfirmDialog state={state.confirmState} titleKey="admin.common.confirmTitle" />
    </>
  )
}
