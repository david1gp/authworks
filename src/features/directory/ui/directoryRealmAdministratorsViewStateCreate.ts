import * as v from "valibot"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { authenticatedUrlSearchParamWrite } from "../../../ui/authenticated/authenticatedUrlSearchParamWrite.js"
import type { DirectoryRealmAdministratorsPageState } from "./directoryRealmAdministratorsPageStateCreate.js"

const dialogQuerySchema = v.strictObject({ dialog: v.optional(v.picklist(["add-admin"])) })

type DirectoryRealmAdministratorsNavigate = (href: string, options: { readonly replace: boolean }) => void

/**
 * View state for the realm administrators page: the `?dialog=add-admin` grant
 * picker plus the debounced `?q=` user search, both held in the URL.
 */
export function directoryRealmAdministratorsViewStateCreate(options: {
  readonly navigate: DirectoryRealmAdministratorsNavigate
  readonly page: DirectoryRealmAdministratorsPageState
  readonly search: () => string
}) {
  const addSearch = createSignalObject("")

  const dialogOpen = () => {
    const params = new URLSearchParams(options.search())
    return v.safeParse(dialogQuerySchema, { dialog: params.get("dialog") ?? undefined }).success
      ? (params.get("dialog") as string | null) === "add-admin"
      : false
  }
  const dialogParamsSet = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(options.search())
    mutate(params)
    const encoded = params.toString()
    options.navigate(`${window.location.pathname}${encoded.length === 0 ? "" : `?${encoded}`}`, { replace: true })
  }
  const dialogOpenSet = (open: boolean) =>
    dialogParamsSet((params) => {
      if (open) params.set("dialog", "add-admin")
      else {
        params.delete("dialog")
        params.delete("q")
        addSearch.set("")
      }
    })

  const dialogSearchInput = (value: string) => {
    addSearch.set(value)
    authenticatedUrlSearchParamWrite("q", value)
    void options.page.candidateSearch(value)
  }

  return {
    addSearch,
    dialogOpen,
    dialogOpenSet,
    dialogSearchInput,
    page: options.page,
  }
}

export type DirectoryRealmAdministratorsViewState = ReturnType<typeof directoryRealmAdministratorsViewStateCreate>
