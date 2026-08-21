import { AdminScreenView } from "./AdminScreenView.js"
import { adminProductionStateCreate } from "./adminProductionStateCreate.js"
import type { AdminScreen } from "./adminScreenSchema.js"

export function AdminProductionAdapter(props: { readonly screen: AdminScreen }) {
  const state = adminProductionStateCreate(() => props.screen)
  return <AdminScreenView basePath="/admin" screen={props.screen} state={state} />
}
