import { listPageSizeDefault } from "./listPageSizeDefault.js"
import { listPageSizeMax } from "./listPageSizeMax.js"

export function listPageSizeResolve(pageSize: number | undefined): number {
  return Math.max(1, Math.min(Math.trunc(pageSize ?? listPageSizeDefault), listPageSizeMax))
}
