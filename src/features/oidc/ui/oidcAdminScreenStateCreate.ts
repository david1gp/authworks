import { useLocation, useNavigate } from "@solidjs/router"
import * as v from "valibot"
import type { OidcAdminAdapter } from "./oidcAdminAdapter.js"
import { oidcAdminClientDetailViewStateCreate } from "./oidcAdminClientDetailViewStateCreate.js"
import { oidcAdminClientListViewStateCreate } from "./oidcAdminClientListViewStateCreate.js"
import { oidcAdminConsentsViewStateCreate } from "./oidcAdminConsentsViewStateCreate.js"
import { oidcAdminPageStateCreate } from "./oidcAdminPageStateCreate.js"
import type { OidcAdminIssuedSecret } from "./oidcAdminIssuedSecret.js"
import type { OidcAdminScreen } from "./oidcAdminScreenSchema.js"

const dialogSchema = v.picklist(["client"])

/**
 * Wires the adapter-agnostic page state to URL-held view state so dialogs, search, and the
 * selected consent subject survive reloads and deep links.
 */
export function oidcAdminScreenStateCreate(options: {
  readonly adapter: OidcAdminAdapter
  readonly basePath: string
  readonly confirm: (message: string) => boolean
  readonly clientId: () => string | undefined
  readonly issuedSecretSeed?: () => OidcAdminIssuedSecret | undefined
  readonly screen: () => OidcAdminScreen
}) {
  const location = useLocation()
  const navigate = useNavigate()

  const searchParamsSet = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(location.search)
    mutate(params)
    const encoded = params.toString()
    navigate(`${location.pathname}${encoded.length === 0 ? "" : `?${encoded}`}`, { replace: true })
  }
  const dialogOpen = (kind: v.InferOutput<typeof dialogSchema>) => {
    const parsed = v.safeParse(dialogSchema, new URLSearchParams(location.search).get("dialog"))
    return parsed.success && parsed.output === kind
  }
  const dialogOpenSet = (kind: v.InferOutput<typeof dialogSchema>) => (open: boolean) =>
    searchParamsSet((params) => {
      if (open) params.set("dialog", kind)
      else params.delete("dialog")
    })
  const search = () => new URLSearchParams(location.search).get("q") ?? ""
  const consentUserId = () => new URLSearchParams(location.search).get("userId") ?? undefined

  const page = oidcAdminPageStateCreate({
    adapter: options.adapter,
    clientId: options.clientId,
    confirm: options.confirm,
    consentUserId,
    ...(options.issuedSecretSeed === undefined ? {} : { issuedSecretSeed: options.issuedSecretSeed }),
    screen: options.screen,
  })

  return {
    consents: oidcAdminConsentsViewStateCreate({
      consentUserId,
      consentUserIdSet: (userId: string) => searchParamsSet((params) => params.set("userId", userId)),
      page,
    }),
    detail: oidcAdminClientDetailViewStateCreate({
      onRemoved: () => navigate(`${options.basePath}/oidc-clients`),
      page,
    }),
    list: oidcAdminClientListViewStateCreate({
      clientOpen: (clientId) => navigate(`${options.basePath}/oidc-clients/${clientId}`),
      createOpen: () => dialogOpen("client"),
      createOpenSet: dialogOpenSet("client"),
      page,
      search,
      searchSet: (value: string) =>
        searchParamsSet((params) => {
          if (value.length === 0) params.delete("q")
          else params.set("q", value)
        }),
    }),
    page,
    screen: options.screen,
  }
}
