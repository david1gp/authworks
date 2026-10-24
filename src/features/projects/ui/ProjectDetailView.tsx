import { mdiApplicationOutline } from "@adaptive-ds/mdi/mdiApplicationOutline.js"
import { mdiArrowLeft } from "@adaptive-ds/mdi/mdiArrowLeft.js"
import { mdiCancel } from "@adaptive-ds/mdi/mdiCancel.js"
import { mdiCheckCircle } from "@adaptive-ds/mdi/mdiCheckCircle.js"
import { mdiDeleteOutline } from "@adaptive-ds/mdi/mdiDeleteOutline.js"
import { mdiEyeOutline } from "@adaptive-ds/mdi/mdiEyeOutline.js"
import { mdiPencil } from "@adaptive-ds/mdi/mdiPencil.js"
import { mdiShieldOutline } from "@adaptive-ds/mdi/mdiShieldOutline.js"
import { mdiTuneVariant } from "@adaptive-ds/mdi/mdiTuneVariant.js"
import { A } from "@solidjs/router"
import { Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { AuthenticatedActionMenu } from "../../../ui/authenticated/AuthenticatedActionMenu.js"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedChip } from "../../../ui/authenticated/AuthenticatedChip.js"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedProfileHeader } from "../../../ui/authenticated/AuthenticatedProfileHeader.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { AuthenticatedTabs } from "../../../ui/authenticated/AuthenticatedTabs.js"
import type { AuthenticatedActionMenuItem } from "../../../ui/authenticated/authenticatedActionMenuItem.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import { ProjectDetailAccessTab } from "./ProjectDetailAccessTab.js"
import { ProjectDetailApplicationsTab } from "./ProjectDetailApplicationsTab.js"
import { ProjectDetailOverviewTab } from "./ProjectDetailOverviewTab.js"
import { ProjectDetailRolesTab } from "./ProjectDetailRolesTab.js"
import type { projectAdminScreenStateCreate } from "./projectAdminScreenStateCreate.js"
import { projectAdminStatusTone } from "./projectAdminStatusTone.js"

type ProjectDetailScreenState = ReturnType<typeof projectAdminScreenStateCreate>

/** Tabbed project detail: header with lifecycle menu, tabs, and the active tab content. */
export function ProjectDetailView(props: { readonly state: ProjectDetailScreenState }) {
  const state = props.state
  const owned = () => state.page.projectOwned()
  const project = () => state.page.project()

  const actionItems = (): AuthenticatedActionMenuItem[] => {
    const current = project()
    if (current === undefined || !owned()) return []
    const items: AuthenticatedActionMenuItem[] = [
      {
        icon: mdiPencil,
        label: messageTranslate("admin.projects.detail.rename"),
        onSelect: () => state.detail.renameOpenSet(true),
      },
    ]
    if (current.status === "active")
      items.push({
        icon: mdiCancel,
        label: messageTranslate("admin.projects.lifecycle.deactivate"),
        onSelect: () => state.detail.lifecycleSet("inactive"),
      })
    if (current.status === "inactive")
      items.push({
        icon: mdiCheckCircle,
        label: messageTranslate("admin.projects.lifecycle.activate"),
        onSelect: () => state.detail.lifecycleSet("active"),
      })
    items.push({
      icon: mdiDeleteOutline,
      label: messageTranslate("admin.projects.detail.remove"),
      onSelect: () => state.detail.removeOpenSet(true),
      tone: "danger",
    })
    return items
  }

  return (
    <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
      <A
        class="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-accent hover:underline"
        href={state.detail.backHref()}
      >
        <Icon aria-hidden="true" class="size-3.5" path={mdiArrowLeft} />
        {messageTranslate("admin.projects.detail.backToProjects")}
      </A>

      <Show when={state.page.status() !== "loading"} fallback={<ProductionStatePanel state="loading" />}>
        <Show
          when={state.page.status() === "ready"}
          fallback={
            <ProductionStatePanel
              detail={state.page.error()}
              onRetry={state.page.status() === "error" ? state.page.reload : undefined}
              state={
                state.page.status() === "permission-denied" || state.page.status() === "cross-tenant"
                  ? "inaccessible"
                  : state.page.status() === "empty"
                    ? "empty"
                    : "error"
              }
              title={messageTranslate("admin.projects.detailTitle")}
            />
          }
        >
          <AuthenticatedProfileHeader
            actions={
              <AuthenticatedActionMenu items={actionItems()} label={messageTranslate("admin.projects.detailTitle")} />
            }
            chips={
              <>
                <AuthenticatedChip
                  label={messageTranslate(owned() ? "admin.projects.detail.owned" : "admin.projects.detail.shared")}
                  tone={owned() ? "accent" : "neutral"}
                />
                <Show when={project()}>
                  {(current) => (
                    <AuthenticatedStatus
                      label={messageTranslate(`admin.projects.statusValue.${current().status}`)}
                      tone={projectAdminStatusTone(current().status)}
                    />
                  )}
                </Show>
              </>
            }
            subtitle={
              <Show when={project()}>
                {(current) => <span>{state.page.organizationName(current().organizationId)}</span>}
              </Show>
            }
            title={project()?.name ?? messageTranslate("admin.projects.detailTitle")}
          />

          <Show when={!owned()}>
            <AuthenticatedNotice message={messageTranslate("admin.projects.detail.readOnly")} />
          </Show>
          <Show when={state.page.notice()}>
            {(name) => <AuthenticatedNotice message={messageTranslate("admin.projects.saved", { name: name() })} />}
          </Show>

          <AuthenticatedTabs
            active={state.tab()}
            items={[
              {
                href: state.detail.tabHref("overview"),
                icon: mdiTuneVariant,
                label: messageTranslate("admin.projects.detail.overviewTab"),
                value: "overview",
              },
              {
                href: state.detail.tabHref("roles"),
                icon: mdiShieldOutline,
                label: messageTranslate("admin.projects.detail.rolesTab"),
                value: "roles",
              },
              {
                href: state.detail.tabHref("applications"),
                icon: mdiApplicationOutline,
                label: messageTranslate("admin.projects.detail.applicationsTab"),
                value: "applications",
              },
              {
                href: state.detail.tabHref("access"),
                icon: mdiEyeOutline,
                label: messageTranslate("admin.projects.detail.accessTab"),
                value: "access",
              },
            ]}
            label={messageTranslate("admin.projects.detailTitle")}
          />

          <Show when={state.tab() === "overview"}>
            <ProjectDetailOverviewTab owned={owned()} state={state.overview} />
          </Show>
          <Show when={state.tab() === "roles"}>
            <ProjectDetailRolesTab owned={owned()} state={state.rolesTab} />
          </Show>
          <Show when={state.tab() === "applications"}>
            <ProjectDetailApplicationsTab owned={owned()} state={state.applications} />
          </Show>
          <Show when={state.tab() === "access"}>
            <ProjectDetailAccessTab owned={owned()} state={state.accessTab} />
          </Show>

          <AuthenticatedDialog
            description={messageTranslate("admin.projects.detail.renameDescription")}
            onOpenChange={state.detail.renameOpenSet}
            open={state.detail.renameOpen()}
            title={messageTranslate("admin.projects.detail.renameTitle")}
          >
            <form class="grid gap-4" onSubmit={state.detail.renameSubmit}>
              <div class="grid gap-1.5">
                <Label class="text-[0.8125rem] font-medium" for="project-detail-rename">
                  {messageTranslate("admin.projects.list.name")}
                </Label>
                <AuthenticatedInput
                  id="project-detail-rename"
                  onInput={(event) => state.detail.renameName.set(event.currentTarget.value)}
                  value={state.detail.renameName.get()}
                />
              </div>
              <Show when={state.detail.renameError()}>
                {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
              </Show>
              <div class="flex justify-end gap-2">
                <AuthenticatedButton icon={mdiPencil} type="submit" variant="filledBlue">
                  {messageTranslate("admin.projects.detail.rename")}
                </AuthenticatedButton>
              </div>
            </form>
          </AuthenticatedDialog>

          <Show when={project()}>
            {(_) => (
              <AuthenticatedDialog
                description={messageTranslate("admin.projects.deleteConfirm")}
                onOpenChange={state.detail.removeOpenSet}
                open={state.detail.removeOpen()}
                title={messageTranslate("admin.projects.deleteConfirmTitle")}
              >
                <form class="grid gap-4" onSubmit={(event) => void state.detail.removeSubmit(event)}>
                  <p class="text-sm text-muted-foreground">
                    {messageTranslate("admin.projects.detail.removeTypePrompt")}
                  </p>
                  <div class="grid gap-1.5">
                    <Label class="text-[0.8125rem] font-medium" for="project-detail-remove-confirm">
                      {messageTranslate("admin.projects.detail.removeTypeLabel")}
                    </Label>
                    <AuthenticatedInput
                      autocomplete="off"
                      id="project-detail-remove-confirm"
                      onInput={(event) => {
                        state.detail.removeName.set(event.currentTarget.value)
                        state.detail.removeErrorClear()
                      }}
                      value={state.detail.removeName.get()}
                    />
                  </div>
                  <Show when={state.detail.removeError()}>
                    {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
                  </Show>
                  <div class="flex justify-end gap-2">
                    <AuthenticatedButton
                      disabled={state.page.pendingId() !== undefined}
                      icon={mdiDeleteOutline}
                      type="submit"
                      variant="filledRed"
                    >
                      {messageTranslate("admin.projects.deleteConfirmAccept")}
                    </AuthenticatedButton>
                  </div>
                </form>
              </AuthenticatedDialog>
            )}
          </Show>
        </Show>
      </Show>
    </div>
  )
}
