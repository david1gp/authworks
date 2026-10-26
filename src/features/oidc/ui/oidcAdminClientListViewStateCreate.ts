import type { Result } from "#result"
import * as v from "valibot"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { ProjectApplication } from "../../projects/public/projectApplicationSchema.js"
import type { ProjectListItem } from "../../projects/public/projectListItemSchema.js"
import { oidcAccessTokenLifetimeSecondsSchema } from "../public/oidcAccessTokenLifetimeSecondsSchema.js"
import { oidcClientCreateRequestSchema } from "../public/oidcClientCreateRequestSchema.js"
import { oidcIdTokenLifetimeSecondsSchema } from "../public/oidcIdTokenLifetimeSecondsSchema.js"
import { oidcRefreshTokenAbsoluteLifetimeSecondsSchema } from "../public/oidcRefreshTokenAbsoluteLifetimeSecondsSchema.js"
import { oidcRefreshTokenIdleLifetimeSecondsSchema } from "../public/oidcRefreshTokenIdleLifetimeSecondsSchema.js"
import type { OidcAdminPageState } from "./oidcAdminPageStateCreate.js"
import { oidcAdminGrantTypesSupported } from "./oidcAdminGrantTypesSupported.js"
import { oidcAdminLifetimeParse } from "./oidcAdminLifetimeParse.js"
import { oidcAdminResponseTypesSupported } from "./oidcAdminResponseTypesSupported.js"
import { oidcAdminScopesSupported } from "./oidcAdminScopesSupported.js"
import { oidcAdminUriListParse } from "./oidcAdminUriListParse.js"

/** View state for the OIDC client directory: search, the create dialog, and navigation. */
export function oidcAdminClientListViewStateCreate(options: {
  readonly applicationList?: (projectId: string) => Promise<Result<readonly ProjectApplication[]>>
  readonly createOpen: () => boolean
  readonly createOpenSet: (open: boolean) => void
  readonly page: OidcAdminPageState
  readonly clientOpen: (clientId: string) => void
  readonly projectList?: () => Promise<Result<readonly ProjectListItem[]>>
  readonly search: () => string
  readonly searchSet: (value: string) => void
}) {
  const name = createSignalObject("")
  // The native select binds a plain string signal; the value is validated on submit.
  const clientType = createSignalObject("confidential")
  const redirectUris = createSignalObject("")
  const postLogoutRedirectUris = createSignalObject("")
  const additionalOrigins = createSignalObject("")
  const scopes = createSignalObject<readonly string[]>(["openid", "profile", "email"])
  const accessTokenRoleAssertion = createSignalObject(false)
  const idTokenUserinfoAssertion = createSignalObject(false)
  const idTokenRoleAssertion = createSignalObject(false)
  const projectId = createSignalObject("")
  const applicationId = createSignalObject("")
  const projects = createSignalObject<readonly ProjectListItem[]>([])
  const applications = createSignalObject<readonly ProjectApplication[]>([])
  const accessTokenLifetimeSeconds = createSignalObject("")
  const idTokenLifetimeSeconds = createSignalObject("")
  const refreshTokenIdleLifetimeSeconds = createSignalObject("")
  const refreshTokenAbsoluteLifetimeSeconds = createSignalObject("")
  const grantTypes = createSignalObject<readonly string[]>([...oidcAdminGrantTypesSupported])
  const responseTypes = createSignalObject<readonly string[]>([...oidcAdminResponseTypesSupported])
  const devMode = createSignalObject(false)
  const requireConsent = createSignalObject(true)
  const trusted = createSignalObject(false)
  const formError = createSignalObject<string | undefined>(undefined)

  const projectsLoad = async () => {
    if (options.projectList === undefined) return
    const result = await options.projectList()
    if (result.success) projects.set([...result.data])
  }
  const applicationsLoad = async (project: string) => {
    if (project === "" || options.applicationList === undefined) {
      applications.set([])
      return
    }
    const result = await options.applicationList(project)
    if (result.success) applications.set([...result.data])
  }
  void projectsLoad()

  const projectSelect = (next: string) => {
    projectId.set(next)
    applicationId.set("")
    void applicationsLoad(next)
  }

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
    const parsedAdditionalOrigins = oidcAdminUriListParse(additionalOrigins.get())
    const accessTokenLifetime = oidcAdminLifetimeParse(
      accessTokenLifetimeSeconds.get(),
      oidcAccessTokenLifetimeSecondsSchema,
    )
    const idTokenLifetime = oidcAdminLifetimeParse(idTokenLifetimeSeconds.get(), oidcIdTokenLifetimeSecondsSchema)
    const refreshIdleLifetime = oidcAdminLifetimeParse(
      refreshTokenIdleLifetimeSeconds.get(),
      oidcRefreshTokenIdleLifetimeSecondsSchema,
    )
    const refreshAbsoluteLifetime = oidcAdminLifetimeParse(
      refreshTokenAbsoluteLifetimeSeconds.get(),
      oidcRefreshTokenAbsoluteLifetimeSecondsSchema,
    )
    if (
      !accessTokenLifetime.success ||
      !idTokenLifetime.success ||
      !refreshIdleLifetime.success ||
      !refreshAbsoluteLifetime.success
    ) {
      formError.set(messageTranslate("admin.oidc.clients.lifetimesInvalid"))
      return
    }
    const project = projectId.get()
    const parsed = v.safeParse(oidcClientCreateRequestSchema, {
      allowedScopes: scopes.get().length === 0 ? undefined : [...scopes.get()],
      ...(accessTokenLifetime.data === undefined ? {} : { accessTokenLifetimeSeconds: accessTokenLifetime.data }),
      accessTokenRoleAssertion: accessTokenRoleAssertion.get(),
      ...(applicationId.get() === "" || project === "" ? {} : { applicationId: applicationId.get() }),
      clientType: clientType.get(),
      additionalOrigins: [...parsedAdditionalOrigins],
      devMode: devMode.get(),
      grantTypes: [...grantTypes.get()],
      ...(idTokenLifetime.data === undefined ? {} : { idTokenLifetimeSeconds: idTokenLifetime.data }),
      idTokenRoleAssertion: idTokenRoleAssertion.get(),
      idTokenUserinfoAssertion: idTokenUserinfoAssertion.get(),
      name: name.get(),
      postLogoutRedirectUris: parsedPostLogout.length === 0 ? undefined : [...parsedPostLogout],
      ...(project === "" ? {} : { projectId: project }),
      redirectUris: [...parsedRedirects],
      ...(refreshAbsoluteLifetime.data === undefined
        ? {}
        : { refreshTokenAbsoluteLifetimeSeconds: refreshAbsoluteLifetime.data }),
      ...(refreshIdleLifetime.data === undefined ? {} : { refreshTokenIdleLifetimeSeconds: refreshIdleLifetime.data }),
      requireConsent: requireConsent.get(),
      responseTypes: [...responseTypes.get()],
      trusted: trusted.get(),
    })
    if (!parsed.success) {
      formError.set(messageTranslate("admin.oidc.clients.invalid"))
      return
    }
    formError.set(undefined)
    const created = await options.page.clientCreate(parsed.output)
    if (!created) return
    name.set("")
    redirectUris.set("")
    postLogoutRedirectUris.set("")
    additionalOrigins.set("")
    accessTokenRoleAssertion.set(false)
    idTokenUserinfoAssertion.set(false)
    idTokenRoleAssertion.set(false)
    projectId.set("")
    applicationId.set("")
    applications.set([])
    accessTokenLifetimeSeconds.set("")
    idTokenLifetimeSeconds.set("")
    refreshTokenIdleLifetimeSeconds.set("")
    refreshTokenAbsoluteLifetimeSeconds.set("")
    grantTypes.set([...oidcAdminGrantTypesSupported])
    responseTypes.set([...oidcAdminResponseTypesSupported])
    devMode.set(false)
    options.createOpenSet(false)
  }

  return {
    accessTokenLifetimeSeconds,
    accessTokenRoleAssertion,
    additionalOrigins,
    applicationId,
    applications: applications.get,
    applicationSelect: (next: string) => applicationId.set(next),
    clientOpen: options.clientOpen,
    clientType,
    createOpen: options.createOpen,
    createOpenSet: (open: boolean) => {
      formError.set(undefined)
      if (open) void projectsLoad()
      options.createOpenSet(open)
    },
    createSubmit,
    devMode,
    filteredClients,
    formError: formError.get,
    grantToggle: (grant: string) =>
      grantTypes.set(
        grantTypes.get().includes(grant)
          ? grantTypes.get().filter((item) => item !== grant)
          : [...grantTypes.get(), grant],
      ),
    grants: grantTypes.get,
    grantsSupported: oidcAdminGrantTypesSupported,
    idTokenLifetimeSeconds,
    idTokenRoleAssertion,
    idTokenUserinfoAssertion,
    name,
    page: options.page,
    postLogoutRedirectUris,
    projectId: { get: projectId.get, set: projectSelect },
    projects: projects.get,
    projectSelect,
    redirectUris,
    refreshTokenAbsoluteLifetimeSeconds,
    refreshTokenIdleLifetimeSeconds,
    requireConsent,
    responseToggle: (response: string) =>
      responseTypes.set(
        responseTypes.get().includes(response)
          ? responseTypes.get().filter((item) => item !== response)
          : [...responseTypes.get(), response],
      ),
    responses: responseTypes.get,
    responsesSupported: oidcAdminResponseTypesSupported,
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
