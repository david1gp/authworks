import { expect, test } from "@playwright/test"

const projectId = "01900000-0000-7000-8000-000000000031"
const mobileViewport = { height: 844, width: 390 } as const

test.describe("task 20 administration signoff regressions", () => {
  test("the demo administration directory fits the mobile viewport", async ({ page }) => {
    await page.setViewportSize(mobileViewport)
    await page.goto("/demo/admin")
    await page.locator("main h1").waitFor({ state: "visible" })

    // The scenario card path is a flex item, whose default `min-width: auto` previously let the
    // longest unwrapped route widen the whole document to 586px.
    const width = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))
    expect(width.scroll).toBeLessThanOrEqual(width.client)

    const path = page.getByText(`/admin/projects/${projectId}/effective-access`, { exact: true })
    await expect(path).toBeVisible()
    const box = await path.boundingBox()
    expect(box?.x ?? 0).toBeGreaterThanOrEqual(0)
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width.client)
  })

  test("the create-user trigger only references the dialog while it exists", async ({ page }) => {
    await page.setViewportSize(mobileViewport)
    await page.goto("/demo/admin/users")
    const trigger = page.getByRole("button", { name: "Create user", exact: true })

    // A closed dialog is unmounted, so a retained `aria-controls` would be a dangling reference.
    await expect(trigger).not.toHaveAttribute("aria-controls", /.+/)

    await trigger.click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    const dialogId = await dialog.getAttribute("id")
    expect(dialogId).toBeTruthy()
    await expect(trigger).toHaveAttribute("aria-controls", dialogId ?? "")
  })

  test("the create-user dialog uses the responsive authenticated width on mobile", async ({ page }) => {
    await page.setViewportSize(mobileViewport)
    await page.goto("/demo/admin/users")
    await page.getByRole("button", { name: "Create user", exact: true }).click()

    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    // `w-[calc(100vw-2rem)] max-w-lg` leaves a 16px gutter on each side instead of shrinking to fit.
    const box = await dialog.boundingBox()
    expect(box?.width ?? 0).toBeGreaterThan(mobileViewport.width - 64)
    expect(box?.width ?? 0).toBeLessThanOrEqual(mobileViewport.width - 32)

    await expect(dialog.getByLabel("Email address", { exact: true })).toBeVisible()
    await expect(dialog.getByLabel("Username", { exact: true })).toBeVisible()
    await expect(dialog.getByLabel("Display name", { exact: true })).toBeVisible()
  })

  test("project removal confirms with project-specific title, description, and action", async ({ page }) => {
    await page.goto(`/demo/admin/projects/${projectId}`)
    await page.locator("main h1").waitFor({ state: "visible" })
    await page.getByRole("button", { name: "Remove", exact: true }).click()

    const dialog = page.getByRole("alertdialog")
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole("heading", { name: "Delete this project", exact: true })).toBeVisible()
    await expect(
      dialog.getByText("Delete this project? Applications, roles, and grants are removed with it.", { exact: true }),
    ).toBeVisible()
    await expect(dialog.getByRole("button", { name: "Delete project", exact: true })).toBeVisible()
    await expect(dialog.getByRole("button", { name: "Continue", exact: true })).toHaveCount(0)

    // Cancel stays non-destructive and returns to the unchanged project.
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page).toHaveURL(new RegExp(`/demo/admin/projects/${projectId}$`))
  })
})
