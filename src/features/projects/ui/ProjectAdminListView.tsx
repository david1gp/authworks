import { mdiPlus } from "@adaptive-ds/mdi/mdiPlus.js"
import { Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedChip } from "../../../ui/authenticated/AuthenticatedChip.js"
import { AuthenticatedDataTable } from "../../../ui/authenticated/AuthenticatedDataTable.js"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedEmptyState } from "../../../ui/authenticated/AuthenticatedEmptyState.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedPageHeader } from "../../../ui/authenticated/AuthenticatedPageHeader.js"
import { AuthenticatedRelativeTime } from "../../../ui/authenticated/AuthenticatedRelativeTime.js"
import { AuthenticatedSearchField } from "../../../ui/authenticated/AuthenticatedSearchField.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedSelect } from "../../../ui/authenticated/AuthenticatedSelect.js"
import { AuthenticatedSkeleton } from "../../../ui/authenticated/AuthenticatedSkeleton.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { AuthenticatedToolbar } from "../../../ui/authenticated/AuthenticatedToolbar.js"
import type { AuthenticatedDataTableColumn } from "../../../ui/authenticated/authenticatedDataTableColumn.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { ProjectListItem } from "../public/projectListItemSchema.js"
import type { projectAdminListViewStateCreate } from "./projectAdminListViewStateCreate.js"
import { projectAdminStatusTone } from "./projectAdminStatusTone.js"

/** Project directory: header, create dialog, search, and the data table. */
export function ProjectAdminListView(props: { readonly state: ReturnType<typeof projectAdminListViewStateCreate> }) {
  const state = props.state
  const columns: AuthenticatedDataTableColumn<ProjectListItem>[] = [
    {
      cell: (project) => (
        <span class="grid min-w-0">
          <span class="truncate font-medium">{project.name}</span>
          <span class="truncate text-xs text-muted-foreground">
            {state.page.organizationName(project.organizationId)}
          </span>
        </span>
      ),
      header: messageTranslate("admin.projects.list.name"),
      key: "name",
    },
    {
      cell: (project) => (
        <AuthenticatedChip
          label={messageTranslate(
            project.organizationId === state.page.organizations()[0]?.id
              ? "admin.projects.detail.owned"
              : "admin.projects.detail.shared",
          )}
          tone={project.organizationId === state.page.organizations()[0]?.id ? "accent" : "neutral"}
        />
      ),
      header: messageTranslate("admin.projects.detail.organization"),
      key: "ownership",
    },
    {
      cell: (project) => <span class="tabular-nums">{project.roleCount ?? 0}</span>,
      header: messageTranslate("admin.projects.list.roles"),
      key: "roles",
    },
    {
      cell: (project) => <span class="tabular-nums">{project.applicationCount ?? 0}</span>,
      header: messageTranslate("admin.projects.list.applications"),
      key: "applications",
    },
    {
      cell: (project) => (
        <AuthenticatedStatus
          label={messageTranslate(`admin.projects.statusValue.${project.status}`)}
          tone={projectAdminStatusTone(project.status)}
        />
      ),
      header: messageTranslate("admin.projects.status"),
      key: "status",
    },
    {
      cell: (project) => <AuthenticatedRelativeTime value={project.createdAt} />,
      header: messageTranslate("admin.projects.detail.created"),
      key: "created",
    },
  ]

  return (
    <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
      <AuthenticatedPageHeader
        actions={
          <AuthenticatedDialog
            description={messageTranslate("admin.projects.list.description")}
            onOpenChange={state.createOpenSet}
            open={state.createOpen()}
            title={messageTranslate("admin.projects.list.create")}
            triggerIcon={mdiPlus}
            triggerLabel={messageTranslate("admin.projects.list.create")}
            variant="filledBlue"
          >
            <form class="grid gap-4" onSubmit={(event) => void state.createSubmit(event)}>
              <div class="grid gap-1.5">
                <Label class="text-[0.8125rem] font-medium" for="project-name">
                  {messageTranslate("admin.projects.list.name")}
                </Label>
                <AuthenticatedInput
                  id="project-name"
                  onInput={(event) => state.name.set(event.currentTarget.value)}
                  value={state.name.get()}
                />
              </div>
              <Show when={state.page.organizations().length > 1}>
                <div class="grid gap-1.5">
                  <Label class="text-[0.8125rem] font-medium" for="project-organization">
                    {messageTranslate("admin.projects.detail.organization")}
                  </Label>
                  <AuthenticatedSelect
                    getOptions={() => state.page.organizations().map((organization) => organization.id)}
                    id="project-organization"
                    valueSignal={state.organizationId}
                    valueText={(id) => state.page.organizationName(id)}
                  />
                </div>
              </Show>
              <Show when={state.formError()}>
                {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
              </Show>
              <div class="flex justify-end gap-2">
                <AuthenticatedButton type="submit" variant="filledBlue">
                  {messageTranslate("admin.projects.list.create")}
                </AuthenticatedButton>
              </div>
            </form>
          </AuthenticatedDialog>
        }
        description={messageTranslate("admin.projects.list.subtitle")}
        title={messageTranslate("admin.projects.list.title")}
      />

      <AuthenticatedToolbar label={messageTranslate("admin.projects.list.title")}>
        <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <AuthenticatedSearchField
            onInput={state.searchInput}
            placeholder={messageTranslate("admin.projects.list.search")}
            value={state.search()}
          />
          <AuthenticatedSelect
            aria-label={messageTranslate("admin.projects.status")}
            getOptions={() => ["active", "inactive", "all"]}
            id="project-status"
            valueSignal={{ get: state.statusFilter, set: state.statusFilterSet }}
            valueText={(value) =>
              value === "all"
                ? messageTranslate("admin.projects.list.statusAll")
                : messageTranslate(`admin.projects.statusValue.${value as "active" | "inactive"}`)
            }
          />
        </div>
      </AuthenticatedToolbar>

      <Show
        when={state.page.status() === "ready" || state.page.status() === "empty"}
        fallback={
          <Show
            when={state.page.status() === "loading"}
            fallback={
              <ProductionStatePanel
                detail={state.page.error()}
                onRetry={state.page.status() === "error" ? state.page.reload : undefined}
                state={
                  state.page.status() === "permission-denied" || state.page.status() === "cross-tenant"
                    ? "inaccessible"
                    : "error"
                }
                title={messageTranslate("admin.projects.list.title")}
              />
            }
          >
            <AuthenticatedSection>
              <div class="grid gap-2 p-5">
                <AuthenticatedSkeleton class="h-9 w-48" />
                <AuthenticatedSkeleton />
                <AuthenticatedSkeleton />
                <AuthenticatedSkeleton />
              </div>
            </AuthenticatedSection>
          </Show>
        }
      >
        <Show
          when={state.filteredProjects().length > 0}
          fallback={
            <AuthenticatedSection>
              <AuthenticatedEmptyState
                description={messageTranslate("admin.projects.list.emptyDetail")}
                title={messageTranslate("admin.projects.list.empty")}
              />
            </AuthenticatedSection>
          }
        >
          <AuthenticatedSection>
            <AuthenticatedDataTable
              caption={messageTranslate("admin.projects.list.title")}
              columns={columns}
              rowHref={(project) => state.projectHref(project.id)}
              rowKey={(project) => project.id}
              rows={state.filteredProjects()}
            />
          </AuthenticatedSection>
        </Show>
      </Show>
    </div>
  )
}
