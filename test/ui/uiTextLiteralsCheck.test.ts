import { expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
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
