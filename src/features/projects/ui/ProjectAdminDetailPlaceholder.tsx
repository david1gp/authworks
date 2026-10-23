import { mdiApplicationOutline } from "@adaptive-ds/mdi/mdiApplicationOutline.js"
import { mdiEyeOutline } from "@adaptive-ds/mdi/mdiEyeOutline.js"
import { mdiShieldOutline } from "@adaptive-ds/mdi/mdiShieldOutline.js"
import { mdiTuneVariant } from "@adaptive-ds/mdi/mdiTuneVariant.js"
import { useLocation } from "@solidjs/router"
import { AuthenticatedPageHeader } from "../../../ui/authenticated/AuthenticatedPageHeader.js"
import { AuthenticatedTabs } from "../../../ui/authenticated/AuthenticatedTabs.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { DirectoryAdminPlaceholder } from "../../directory/ui/DirectoryAdminPlaceholder.js"
import { ProjectAdminStateBoundary } from "./ProjectAdminStateBoundary.js"
import type { projectAdminDetailViewStateCreate } from "./projectAdminDetailViewStateCreate.js"
import { projectDetailTabSelect } from "./projectDetailTabSelect.js"

/** Tabbed project detail shell; full page content lands with the projects page task. */
export function ProjectAdminDetailPlaceholder(props: {
  readonly detail: ReturnType<typeof projectAdminDetailViewStateCreate>
}) {
  const location = useLocation()
  const tab = () => projectDetailTabSelect(location.search)
  const projectId = () => props.detail.page.project()?.id ?? ""
  const tabHref = (value: string) =>
    value === "overview" ? `/admin/projects/${projectId()}` : `/admin/projects/${projectId()}?tab=${value}`

  return (
    <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
      <AuthenticatedPageHeader
        description={messageTranslate("admin.projects.detail.placeholder")}
        title={messageTranslate("admin.projects.detailTitle")}
      />
      <AuthenticatedTabs
        active={tab()}
        items={[
          {
            href: tabHref("overview"),
            icon: mdiTuneVariant,
            label: messageTranslate("admin.projects.detail.overviewTab"),
            value: "overview",
          },
          {
            href: tabHref("roles"),
            icon: mdiShieldOutline,
            label: messageTranslate("admin.projects.detail.rolesTab"),
            value: "roles",
          },
          {
            href: tabHref("applications"),
            icon: mdiApplicationOutline,
            label: messageTranslate("admin.projects.detail.applicationsTab"),
            value: "applications",
          },
          {
            href: tabHref("access"),
            icon: mdiEyeOutline,
            label: messageTranslate("admin.projects.detail.accessTab"),
            value: "access",
          },
        ]}
        label={messageTranslate("admin.projects.detailTitle")}
      />
      <ProjectAdminStateBoundary
        emptyDetail={messageTranslate("admin.projects.detail.placeholder")}
        error={props.detail.page.error()}
        onRetry={props.detail.page.reload}
        status={props.detail.page.status()}
      >
        <DirectoryAdminPlaceholder
          descriptionKey="admin.projects.detail.placeholder"
          titleKey="admin.projects.detailTitle"
        />
      </ProjectAdminStateBoundary>
    </div>
  )
}
