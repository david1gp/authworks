import * as v from "valibot"
import { organizationResponseSchema } from "../../../src/features/organizations/public/organizationResponseSchema.js"
import { expect } from "../../harness/e2eExpect.js"
import { e2eTestNameCreate } from "../../harness/e2eTestNameCreate.js"
import {
  e2eWorkflowEntityRecord,
  e2eWorkflowValueGet,
  e2eWorkflowValueSet,
} from "../shared/e2eWorkflowContextCreate.js"
import { adminRealmAdministratorSessionEnsure } from "./adminRealmAdministratorSessionEnsure.js"
import type { AdminRealmAdministratorSetup } from "./adminRealmAdministratorSetupCreate.js"

/** A realm administrator can open a new organization without joining or switching into it. */
export async function adminRealmAdministratorOrganizationDetailCheck(
  setup: AdminRealmAdministratorSetup,
): Promise<void> {
  const { page, checkpointPath, runId } = setup.context
  const name = e2eTestNameCreate(runId, "realm-administrator-detail-org")
  const key = "realm-administrator.detailOrganizationId"
  await adminRealmAdministratorSessionEnsure(setup)
  let id = e2eWorkflowValueGet(checkpointPath, key)
  if (id === undefined) {
    await page.goto("/admin/organizations")
    await page.getByRole("button", { name: "Create organization" }).click()
    const dialog = page.getByRole("dialog", { name: "Create organization" })
    await dialog.getByLabel("Organization name").fill(name)
    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        /\/realms\/[^/]+\/organizations$/.test(new URL(response.url()).pathname),
    )
    await dialog.getByRole("button", { name: "Save" }).click()
    const response = await responsePromise
    expect(response.ok()).toBe(true)
    const created = v.parse(organizationResponseSchema, await response.json())
    id = created.organization.id
    e2eWorkflowEntityRecord(checkpointPath, { createdAt: new Date().toISOString(), id, kind: "organization", name })
    e2eWorkflowValueSet(checkpointPath, key, id)
  }
  await page.goto(`/admin/organizations/${encodeURIComponent(id)}`)
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByLabel("Organization name")).toHaveValue(name)
  await expect(page.getByRole("link", { name: "Members and roles" })).toBeVisible()
  await expect(page.getByText("This organization has no members yet.")).toBeVisible()
  await expect(page.getByRole("heading", { name: "Access unavailable" })).toBeHidden()
}
