import { describe, expect, mock, test } from "bun:test"

mock.module("solid-js", () => ({
  createEffect: (fn: () => void) => fn(),
  createSignal: <T>(initial: T) => {
    let value = initial
    return [() => value, (next: T) => (value = next)] as const
  },
  on: (_deps: unknown, fn: () => void) => fn,
}))

const [{ englishCatalog }, { projectAdminDemoAdapterCreate }, { projectAdminPageStateCreate }] = await Promise.all([
  import("../../src/ui/i18n/model/englishCatalog.js"),
  import("../../src/features/projects/ui/projectAdminDemoAdapterCreate.js"),
  import("../../src/features/projects/ui/projectAdminPageStateCreate.js"),
])

const projectId = "01900000-0000-7000-8000-000000000031"

type Request = { readonly acceptLabel?: string; readonly message: string; readonly title?: string }

const pageWithRecordedPrompt = () => {
  const requests: Request[] = []
  const page = projectAdminPageStateCreate({
    adapter: projectAdminDemoAdapterCreate(() => "success"),
    confirm: (request: Request) => {
      requests.push(request)
      return false
    },
    projectId: () => projectId,
    screen: () => "project-detail",
  })
  return { page, requests }
}

describe("project removal confirmation copy", () => {
  test("deleting a project asks with a project-specific title, description, and accept label", async () => {
    const { page, requests } = pageWithRecordedPrompt()

    expect(await page.projectDelete(projectId)).toBe(false)

    expect(requests).toEqual([
      {
        acceptLabel: englishCatalog["admin.projects.deleteConfirmAccept"],
        message: englishCatalog["admin.projects.deleteConfirm"],
        title: englishCatalog["admin.projects.deleteConfirmTitle"],
      },
    ])
  })

  test("removing a project through its lifecycle asks with removal-specific copy", async () => {
    const { page, requests } = pageWithRecordedPrompt()

    await page.projectLifecycleSet(projectId, "removed")

    expect(requests).toEqual([
      {
        acceptLabel: englishCatalog["admin.projects.lifecycle.removeConfirmAccept"],
        message: englishCatalog["admin.projects.lifecycle.removeConfirm"],
        title: englishCatalog["admin.projects.lifecycle.removeConfirmTitle"],
      },
    ])
  })

  test("every translated catalog carries the new project removal copy", async () => {
    const keys = [
      "admin.projects.deleteConfirmAccept",
      "admin.projects.deleteConfirmTitle",
      "admin.projects.lifecycle.removeConfirmAccept",
      "admin.projects.lifecycle.removeConfirmTitle",
    ]
    const locales = ["ar", "de", "es", "fr", "hu", "it", "ja", "nl", "pl", "pt", "ru", "tr", "uk", "zh"]

    for (const locale of locales) {
      const csv = await Bun.file(new URL(`../../public/i18n/${locale}.csv`, import.meta.url)).text()
      for (const key of keys) expect(csv, `${locale}/${key}`).toContain(`\n${key},`)
    }
  })
})
