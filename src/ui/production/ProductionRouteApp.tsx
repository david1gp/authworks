import { Match, Show, Switch } from "solid-js"
import * as v from "valibot"
import { AccountAccessProductionAdapter } from "../../features/account/ui/AccountAccessProductionAdapter.js"
import { AccountProductionAdapter } from "../../features/account/ui/AccountProductionAdapter.js"
import { AccountSecurityProductionAdapter } from "../../features/account/ui/AccountSecurityProductionAdapter.js"
import { accountSecurityScreenSchema } from "../../features/account/ui/accountSecurityScreenSchema.js"
import { AdminProductionAdapter } from "../../features/admin/ui/AdminProductionAdapter.js"
import { adminScreenSchema } from "../../features/admin/ui/adminScreenSchema.js"
import { ImpersonationAdminProductionAdapter } from "../../features/impersonation/ui/ImpersonationAdminProductionAdapter.js"
import { LoginProductionAdapter } from "../../features/login/ui/LoginProductionAdapter.js"
import { MachineAdminProductionAdapter } from "../../features/machineUsers/ui/MachineAdminProductionAdapter.js"
import { machineAdminScreenSchema } from "../../features/machineUsers/ui/machineAdminScreenSchema.js"
import { OidcAdminProductionAdapter } from "../../features/oidc/ui/OidcAdminProductionAdapter.js"
import { oidcAdminScreenSchema } from "../../features/oidc/ui/oidcAdminScreenSchema.js"
import { OrganizationAdminProductionAdapter } from "../../features/organizations/ui/OrganizationAdminProductionAdapter.js"
import { organizationAdminScreenSchema } from "../../features/organizations/ui/organizationAdminScreenSchema.js"
import { ProjectAdminProductionAdapter } from "../../features/projects/ui/ProjectAdminProductionAdapter.js"
import { projectAdminScreenSchema } from "../../features/projects/ui/projectAdminScreenSchema.js"
import { messageTranslate } from "../i18n/model/messageTranslate.js"
import { ProductionAuthenticatedShell } from "./ProductionAuthenticatedShell.js"
import { ProductionFocusShell } from "./ProductionFocusShell.js"
import { ProductionStatePanel } from "./ProductionStatePanel.js"
import { productionRouteAppStateCreate } from "./productionRouteAppStateCreate.js"
import type { ProductionRouteContract } from "./productionRouteContract.js"

export function ProductionRouteApp(props: { readonly route: ProductionRouteContract }) {
  const state = productionRouteAppStateCreate(() => props.route)
  // The hosted login owns its own branded shell and resolves its realm through runtime discovery,
  // so it must render before the session-context route guard.
  if (props.route.feature === "login") return <LoginProductionAdapter />
  return (
    <Show
      when={state.screen()}
      fallback={
        <ProductionFocusShell title={messageTranslate("shell.guard.pageNotFound")}>
          <ProductionStatePanel
            detail={messageTranslate("shell.guard.destinationUnavailableDetail")}
            state="inaccessible"
            title={messageTranslate("shell.guard.destinationUnavailable")}
          />
        </ProductionFocusShell>
      }
    >
      {(screen) => (
        <Switch>
          <Match when={state.guardState().status === "loading"}>
            <ProductionFocusShell title={messageTranslate(screen().title)}>
              <ProductionStatePanel state="loading" />
            </ProductionFocusShell>
          </Match>
          <Match when={state.guardState().status === "anonymous"}>
            <ProductionFocusShell title={messageTranslate(screen().title)}>
              <ProductionStatePanel
                detail={messageTranslate("shell.guard.signInRequiredDetail")}
                state="inaccessible"
                title={messageTranslate("shell.guard.signInRequired")}
              />
            </ProductionFocusShell>
          </Match>
          <Match when={state.guardState().status === "missing-context"}>
            <ProductionFocusShell title={messageTranslate(screen().title)}>
              <ProductionStatePanel
                detail={messageTranslate("shell.guard.contextRequiredDetail")}
                state="inaccessible"
                title={messageTranslate("shell.guard.contextRequired")}
              />
            </ProductionFocusShell>
          </Match>
          <Match when={state.guardState().status === "insufficient-permission"}>
            <ProductionFocusShell title={messageTranslate(screen().title)}>
              <ProductionStatePanel state="inaccessible" title={messageTranslate("shell.guard.accessUnavailable")} />
            </ProductionFocusShell>
          </Match>
          <Match when={state.guardState().status === "authenticated"}>
            <Show
              when={state.shellKind() !== "focus" && screen().key !== "sign-in"}
              fallback={
                <ProductionFocusShell title={messageTranslate(screen().title)}>
                  <ProductionRouteContent state={state} />
                </ProductionFocusShell>
              }
            >
              <ProductionAuthenticatedShell
                kind={state.shellKind() as "account" | "admin" | "invitations"}
                title={screen().title}
              >
                <header class="mb-7">
                  <Show when={screen().path !== "/account/email"}>
                    <p class="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {messageTranslate("app.name")}
                    </p>
                  </Show>
                  <h1 class="mt-2 text-3xl font-semibold tracking-tight">{messageTranslate(screen().title)}</h1>
                </header>
                <ProductionRouteContent state={state} />
              </ProductionAuthenticatedShell>
            </Show>
          </Match>
        </Switch>
      )}
    </Show>
  )
}

function ProductionRouteContent(props: { state: ReturnType<typeof productionRouteAppStateCreate> }) {
  const accountScreen = () => {
    const parsed = v.safeParse(accountSecurityScreenSchema, props.state.screen()?.key)
    return parsed.success ? parsed.output : undefined
  }
  const realmId = () => {
    const guard = props.state.guardState()
    return guard.status === "authenticated" ? guard.realmId : undefined
  }
  const adminScreen = () => {
    if (props.state.shellKind() !== "admin") return undefined
    const parsed = v.safeParse(adminScreenSchema, props.state.screen()?.key)
    return parsed.success ? parsed.output : undefined
  }
  const projectScreen = () => {
    if (props.state.shellKind() !== "admin") return undefined
    const parsed = v.safeParse(projectAdminScreenSchema, props.state.screen()?.key)
    return parsed.success ? parsed.output : undefined
  }
  const organizationAdminScreen = () => {
    if (props.state.shellKind() !== "admin") return undefined
    const parsed = v.safeParse(organizationAdminScreenSchema, props.state.screen()?.key)
    return parsed.success ? parsed.output : undefined
  }
  const oidcAdminScreen = () => {
    if (props.state.shellKind() !== "admin") return undefined
    const parsed = v.safeParse(oidcAdminScreenSchema, props.state.screen()?.key)
    return parsed.success ? parsed.output : undefined
  }
  const machineAdminScreen = () => {
    if (props.state.shellKind() !== "admin") return undefined
    const parsed = v.safeParse(machineAdminScreenSchema, props.state.screen()?.key)
    return parsed.success ? parsed.output : undefined
  }
  const impersonationScreen = () => props.state.shellKind() === "admin" && props.state.screen()?.key === "impersonation"
  return (
    <Switch>
      <Match when={impersonationScreen()}>
        <ImpersonationAdminProductionAdapter />
      </Match>
      <Match when={machineAdminScreen() !== undefined}>
        <MachineAdminProductionAdapter
          machineUserId={props.state.routeParam("machineUserId")}
          screen={machineAdminScreen()!}
        />
      </Match>
      <Match when={oidcAdminScreen() !== undefined}>
        <OidcAdminProductionAdapter clientId={props.state.routeParam("clientId")} screen={oidcAdminScreen()!} />
      </Match>
      <Match when={organizationAdminScreen() !== undefined}>
        <OrganizationAdminProductionAdapter screen={organizationAdminScreen()!} />
      </Match>
      <Match when={projectScreen() !== undefined}>
        <ProjectAdminProductionAdapter projectId={props.state.routeParam("projectId")} screen={projectScreen()!} />
      </Match>
      <Match when={adminScreen() !== undefined}>
        <AdminProductionAdapter screen={adminScreen()!} />
      </Match>
      <Match when={props.state.screen()?.key === "organizations" && props.state.shellKind() === "account"}>
        <AccountAccessProductionAdapter screen="organizations" />
      </Match>
      <Match when={props.state.screen()?.key === "consents" && props.state.shellKind() === "account"}>
        <AccountAccessProductionAdapter screen="consents" />
      </Match>
      <Match when={props.state.screen()?.key === "overview" && props.state.shellKind() === "invitations"}>
        <AccountAccessProductionAdapter screen="invitations" />
      </Match>
      <Match when={props.state.screen()?.key === "accept" && props.state.shellKind() === "invitations"}>
        <AccountAccessProductionAdapter screen="invitation" />
      </Match>
      <Match when={accountScreen() !== undefined && realmId() !== undefined}>
        <AccountSecurityProductionAdapter realmId={realmId() as string} screen={accountScreen()!} />
      </Match>
      <Match
        when={
          props.state.screen()?.path === "/account" ||
          props.state.screen()?.path === "/account/profile" ||
          props.state.screen()?.path === "/account/email" ||
          props.state.screen()?.path === "/account/password" ||
          props.state.screen()?.path === "/account/delete"
        }
      >
        <AccountProductionAdapter
          kind={(props.state.screen()?.key ?? "overview") as "delete" | "email" | "overview" | "password" | "profile"}
        />
      </Match>
      <Match when={props.state.api.content === "loading"}>
        <ProductionStatePanel state="loading" />
      </Match>
      <Match when={props.state.api.content === "error"}>
        <ProductionStatePanel detail={props.state.api.errorMessage} onRetry={props.state.api.retry} state="error" />
      </Match>
      <Match when={props.state.api.content === "empty" || props.state.api.content === "ready"}>
        <ProductionStatePanel state="empty" />
      </Match>
    </Switch>
  )
}
