import { listPageSizeDefault } from "./listPageSizeDefault.js"
import { listPageSizeMax } from "./listPageSizeMax.js"

export function listPageSizeResolve(pageSize: number | undefined): number {
  return Math.min(pageSize ?? listPageSizeDefault, listPageSizeMax)
}
