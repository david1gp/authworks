import { Show } from "solid-js"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { ProjectAdminPageState } from "./projectAdminPageStateCreate.js"
import { projectAdminStatusTone } from "./projectAdminStatusTone.js"

/**
 * Compact identity strip repeated on every project sub-page, so applications, roles, grants, and
 * effective access always name the project they belong to without a second full-height card.
 */
export function ProjectAdminProjectContext(props: { readonly page: ProjectAdminPageState }) {
  return (
    <Show when={props.page.project()}>
      {(project) => (
        <AuthenticatedSection
          actions={
            <AuthenticatedStatus
              label={messageTranslate(`admin.projects.statusValue.${project().status}`)}
              tone={projectAdminStatusTone(project().status)}
            />
          }
          padded
          title={project().name}
        >
          <AuthenticatedFieldList
            columns={3}
            fields={[
              {
                identifier: true,
                label: messageTranslate("admin.projects.detail.identifier"),
                value: project().id,
              },
              {
                label: messageTranslate("admin.projects.detail.organization"),
                value: props.page.organizationName(project().organizationId),
              },
              {
                label: messageTranslate("admin.projects.detail.authorizationRequired"),
                value: project().authorizationRequired
                  ? messageTranslate("common.enabled")
                  : messageTranslate("common.disabled"),
              },
            ]}
          />
        </AuthenticatedSection>
      )}
    </Show>
  )
}
