import type { Result } from "#result"
import { createEffect, on } from "solid-js"
import * as v from "valibot"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { ProjectApplication } from "../../projects/public/projectApplicationSchema.js"
import type { ProjectListItem } from "../../projects/public/projectListItemSchema.js"
import { oidcAccessTokenLifetimeSecondsSchema } from "../public/oidcAccessTokenLifetimeSecondsSchema.js"
import { oidcClientUpdateRequestSchema } from "../public/oidcClientUpdateRequestSchema.js"
import { oidcIdTokenLifetimeSecondsSchema } from "../public/oidcIdTokenLifetimeSecondsSchema.js"
import { oidcRefreshTokenAbsoluteLifetimeSecondsSchema } from "../public/oidcRefreshTokenAbsoluteLifetimeSecondsSchema.js"
import { oidcRefreshTokenIdleLifetimeSecondsSchema } from "../public/oidcRefreshTokenIdleLifetimeSecondsSchema.js"
import type { OidcAdminPageState } from "./oidcAdminPageStateCreate.js"
import { oidcAdminGrantTypesSupported } from "./oidcAdminGrantTypesSupported.js"
import { oidcAdminLifetimeParse } from "./oidcAdminLifetimeParse.js"
import { oidcAdminResponseTypesSupported } from "./oidcAdminResponseTypesSupported.js"
import { oidcAdminScopesSupported } from "./oidcAdminScopesSupported.js"
import { oidcAdminUriListParse } from "./oidcAdminUriListParse.js"

/**
 * View state for a single OIDC client. The editable form mirrors the loaded client, and the
 * client secret is write-only: it can be rotated or revoked but never read back.
 */
export function oidcAdminClientDetailViewStateCreate(options: {
  readonly applicationList?: (projectId: string) => Promise<Result<readonly ProjectApplication[]>>
  readonly onRemoved: () => void
  readonly page: OidcAdminPageState
  readonly projectList?: () => Promise<Result<readonly ProjectListItem[]>>
}) {
  const name = createSignalObject("")
  const redirectUris = createSignalObject("")
  const postLogoutRedirectUris = createSignalObject("")
  const additionalOrigins = createSignalObject("")
  const scopes = createSignalObject<readonly string[]>([])
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
  const grantTypes = createSignalObject<readonly string[]>([])
  const responseTypes = createSignalObject<readonly string[]>([])
  const devMode = createSignalObject(false)
  const requireConsent = createSignalObject(true)
  const trusted = createSignalObject(false)
  const formError = createSignalObject<string | undefined>(undefined)

  const lifetimeText = (value: number | null) => (value === null ? "" : String(value))

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

  createEffect(
    on(
      () => options.page.client(),
      (client) => {
        if (client === undefined) return
        name.set(client.name)
        redirectUris.set(client.redirectUris.join("\n"))
        postLogoutRedirectUris.set(client.postLogoutRedirectUris.join("\n"))
        additionalOrigins.set(client.additionalOrigins.join("\n"))
        scopes.set([...client.allowedScopes])
        accessTokenRoleAssertion.set(client.accessTokenRoleAssertion)
        idTokenUserinfoAssertion.set(client.idTokenUserinfoAssertion)
        idTokenRoleAssertion.set(client.idTokenRoleAssertion)
        projectId.set(client.projectId ?? "")
        applicationId.set(client.applicationId ?? "")
        accessTokenLifetimeSeconds.set(lifetimeText(client.accessTokenLifetimeSeconds))
        idTokenLifetimeSeconds.set(lifetimeText(client.idTokenLifetimeSeconds))
        refreshTokenIdleLifetimeSeconds.set(lifetimeText(client.refreshTokenIdleLifetimeSeconds))
        refreshTokenAbsoluteLifetimeSeconds.set(lifetimeText(client.refreshTokenAbsoluteLifetimeSeconds))
        grantTypes.set([...client.grantTypes])
        responseTypes.set([...client.responseTypes])
        devMode.set(client.devMode)
        requireConsent.set(client.requireConsent)
        trusted.set(client.trusted)
        void applicationsLoad(client.projectId ?? "")
      },
    ),
  )

  return {
    accessTokenLifetimeSeconds,
    accessTokenRoleAssertion,
    additionalOrigins,
    applicationId,
    applications: applications.get,
    applicationSelect: (next: string) => applicationId.set(next),
    devMode,
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
    settingsSubmit: (event: SubmitEvent) => {
      event.preventDefault()
      const client = options.page.client()
      if (client === undefined) return
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
      const parsed = v.safeParse(oidcClientUpdateRequestSchema, {
        allowedScopes: [...scopes.get()],
        accessTokenLifetimeSeconds: accessTokenLifetime.data ?? null,
        accessTokenRoleAssertion: accessTokenRoleAssertion.get(),
        applicationId: applicationId.get() === "" || project === "" ? null : applicationId.get(),
        additionalOrigins: [...oidcAdminUriListParse(additionalOrigins.get())],
        devMode: devMode.get(),
        grantTypes: [...grantTypes.get()],
        idTokenLifetimeSeconds: idTokenLifetime.data ?? null,
        idTokenRoleAssertion: idTokenRoleAssertion.get(),
        idTokenUserinfoAssertion: idTokenUserinfoAssertion.get(),
        name: name.get(),
        postLogoutRedirectUris: [...oidcAdminUriListParse(postLogoutRedirectUris.get())],
        projectId: project === "" ? null : project,
        redirectUris: [...oidcAdminUriListParse(redirectUris.get())],
        refreshTokenAbsoluteLifetimeSeconds: refreshAbsoluteLifetime.data ?? null,
        refreshTokenIdleLifetimeSeconds: refreshIdleLifetime.data ?? null,
        requireConsent: requireConsent.get(),
        responseTypes: [...responseTypes.get()],
        trusted: trusted.get(),
      })
      if (!parsed.success) {
        formError.set(messageTranslate("admin.oidc.clients.invalid"))
        return
      }
      formError.set(undefined)
      void options.page.clientUpdate(client.id, parsed.output)
    },
    trusted,
    clientRemove: async (clientId: string) => {
      await options.page.clientLifecycleSet(clientId, "removed")
      if (options.page.client()?.status === "removed") options.onRemoved()
    },
  }
}
