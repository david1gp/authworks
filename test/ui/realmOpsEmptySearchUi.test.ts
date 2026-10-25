import { expect, test } from "bun:test"

const clientsViewUrl = new URL("../../src/features/oidc/ui/OidcAdminClientListView.tsx", import.meta.url)
const eventsViewUrl = new URL("../../src/features/admin/ui/AdminEventListView.tsx", import.meta.url)

test("OIDC client search with no matches renders an empty state instead of a header-only table", async () => {
  const source = await Bun.file(clientsViewUrl).text()

  expect(source).toContain("<AuthenticatedEmptyState")
  expect(source).toContain('messageTranslate("admin.oidc.clients.emptySearch")')
  expect(source).toContain("state.filteredClients().length > 0")
  const showStart = source.indexOf("state.filteredClients().length > 0")
  expect(showStart).toBeGreaterThan(-1)
  expect(source.indexOf("<AuthenticatedRecordList", showStart)).toBeGreaterThan(showStart)
  expect(source.indexOf("</Table>", showStart)).toBeGreaterThan(showStart)
})

test("audit event search with no matches renders an empty state instead of a header-only table", async () => {
  const source = await Bun.file(eventsViewUrl).text()

  expect(source).toContain("<AuthenticatedEmptyState")
  expect(source).toContain('messageTranslate("admin.events.empty")')
  expect(source).toContain("props.state.events().length > 0")
  const showStart = source.indexOf("props.state.events().length > 0")
  expect(showStart).toBeGreaterThan(-1)
  expect(source.indexOf("<AuthenticatedRecordList", showStart)).toBeGreaterThan(showStart)
  expect(source.indexOf("</Table>", showStart)).toBeGreaterThan(showStart)
})
