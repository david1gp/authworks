import * as v from "valibot"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { oidcClientCreateRequestSchema } from "../public/oidcClientCreateRequestSchema.js"
import type { OidcAdminPageState } from "./oidcAdminPageStateCreate.js"
import { oidcAdminScopesSupported } from "./oidcAdminScopesSupported.js"
import { oidcAdminUriListParse } from "./oidcAdminUriListParse.js"

/** View state for the OIDC client directory: search, the create dialog, and navigation. */
export function oidcAdminClientListViewStateCreate(options: {
  readonly createOpen: () => boolean
  readonly createOpenSet: (open: boolean) => void
  readonly page: OidcAdminPageState
  readonly clientOpen: (clientId: string) => void
  readonly search: () => string
  readonly searchSet: (value: string) => void
}) {
  const name = createSignalObject("")
  // The native select binds a plain string signal; the value is validated on submit.
  const clientType = createSignalObject("confidential")
  const redirectUris = createSignalObject("")
  const postLogoutRedirectUris = createSignalObject("")
  const scopes = createSignalObject<readonly string[]>(["openid", "profile", "email"])
  const requireConsent = createSignalObject(true)
  const trusted = createSignalObject(false)
  const formError = createSignalObject<string | undefined>(undefined)

  const filteredClients = () => {
    const term = options.search().trim().toLowerCase()
    if (term.length === 0) return options.page.clients()
    return options.page
      .clients()
      .filter((client) => `${client.name} ${client.id} ${client.redirectUris.join(" ")}`.toLowerCase().includes(term))
  }

  const createSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    const parsedRedirects = oidcAdminUriListParse(redirectUris.get())
    const parsedPostLogout = oidcAdminUriListParse(postLogoutRedirectUris.get())
    const parsed = v.safeParse(oidcClientCreateRequestSchema, {
      allowedScopes: scopes.get().length === 0 ? undefined : [...scopes.get()],
      clientType: clientType.get(),
      name: name.get(),
      postLogoutRedirectUris: parsedPostLogout.length === 0 ? undefined : [...parsedPostLogout],
      redirectUris: [...parsedRedirects],
      requireConsent: requireConsent.get(),
      trusted: trusted.get(),
    })
    if (!parsed.success) {
      formError.set("Enter a client name, at least one exact redirect URI, and at least one scope.")
      return
    }
    formError.set(undefined)
    const created = await options.page.clientCreate(parsed.output)
    if (!created) return
    name.set("")
    redirectUris.set("")
    postLogoutRedirectUris.set("")
    options.createOpenSet(false)
  }

  return {
    clientOpen: options.clientOpen,
    clientType,
    createOpen: options.createOpen,
    createOpenSet: (open: boolean) => {
      formError.set(undefined)
      options.createOpenSet(open)
    },
    createSubmit,
    filteredClients,
    formError: formError.get,
    name,
    page: options.page,
    postLogoutRedirectUris,
    redirectUris,
    requireConsent,
    scopeToggle: (scope: string) =>
      scopes.set(
        scopes.get().includes(scope) ? scopes.get().filter((item) => item !== scope) : [...scopes.get(), scope],
      ),
    scopes: scopes.get,
    scopesSupported: oidcAdminScopesSupported,
    search: options.search,
    searchSet: options.searchSet,
    trusted,
  }
}
