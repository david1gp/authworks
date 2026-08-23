import { expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { uiTextLiteralsCheck } from "../../scripts/uiTextLiteralsCheck.js"

test("shared, production, and feature demo views contain no untyped UI prose", () => {
  expect(uiTextLiteralsCheck(process.cwd())).toEqual([])
})

test("the checker only exempts technical attributes and legacy ttc source strings", () => {
  const root = mkdtempSync(join(tmpdir(), "authworks-ui-text-"))
  const sharedUi = join(root, "src", "ui")
  const features = join(root, "src", "features")
  mkdirSync(sharedUi, { recursive: true })
  mkdirSync(features, { recursive: true })
  writeFileSync(
    join(sharedUi, "Fixture.tsx"),
    `export function Fixture() { return <main><span>Untyped text</span><button title="Untyped title" /><input id="field-id" value="technical" />{ttc("Legacy source")}</main> }`,
  )

  try {
    expect(uiTextLiteralsCheck(root).map(({ reason, text }) => ({ reason, text }))).toEqual([
      { reason: "JSX text", text: "Untyped text" },
      { reason: "title attribute", text: "Untyped title" },
    ])
  } finally {
    rmSync(root, { force: true, recursive: true })
  }
})

test("the checker covers production and demo UI state modules without flagging non-visible data", () => {
  const root = mkdtempSync(join(tmpdir(), "authworks-ui-state-"))
  const stateDirectory = join(root, "src", "features", "sample", "ui")
  mkdirSync(join(root, "src", "ui"), { recursive: true })
  mkdirSync(stateDirectory, { recursive: true })
  writeFileSync(
    join(stateDirectory, "sampleAdminFormStateCreate.ts"),
    `export function sampleAdminFormStateCreate() {
  const formError = signal<string | undefined>(undefined)
  const validationMessage = signal<string | undefined>(undefined)
  formError.set("Enter a client name and at least one exact redirect URI.")
  validationMessage.set(messageTranslate("admin.oidc.clients.invalid"))
  other.set("Not a message field at all.")
  return {
    clientId: "client-fixture-id",
    error: () => (selected() === "error" ? "The deterministic fixture failed." : undefined),
    href: "https://example.com/admin/clients",
    status: () => (selected() === "loading" ? "loading" : "ready"),
  }
}`,
  )
  // Colocated tests are never part of the shipped UI and must stay exempt.
  writeFileSync(
    join(stateDirectory, "sampleAdminFormStateCreate.test.ts"),
    `test("fixture", () => { formError.set("Enter a client name in a test.") })`,
  )

  try {
    expect(uiTextLiteralsCheck(root).map(({ reason, text }) => ({ reason, text }))).toEqual([
      { reason: "formError message", text: "Enter a client name and at least one exact redirect URI." },
      { reason: "error message", text: "The deterministic fixture failed." },
    ])
  } finally {
    rmSync(root, { force: true, recursive: true })
  }
})
