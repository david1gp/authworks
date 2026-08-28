import { expect, test } from "bun:test"

const [{ authenticatedStatusToneClassGet }, { authenticatedTableClasses }, { englishCatalog }] = await Promise.all([
  import("../../src/ui/authenticated/authenticatedStatusToneClassGet.js"),
  import("../../src/ui/authenticated/authenticatedTableClasses.js"),
  import("../../src/ui/i18n/model/englishCatalog.js"),
])

test("every status tone resolves to token-based classes rather than literal palette colors", () => {
  const tones = ["accent", "danger", "neutral", "success", "warning"] as const
  for (const tone of tones) {
    const classes = authenticatedStatusToneClassGet(tone)
    expect(classes, tone).toBeTruthy()
    expect(classes, tone).not.toMatch(/\b(?:bg|text|border)-(?:slate|gray|green|red|blue|yellow|sky|amber)-\d{2,3}\b/)
  }
  expect(new Set(tones.map(authenticatedStatusToneClassGet)).size).toBe(tones.length)
})

test("the compact table classes override the vendored roomy header and cell padding", () => {
  expect(authenticatedTableClasses.head).toContain("h-8")
  expect(authenticatedTableClasses.head).toContain("text-2xs")
  expect(authenticatedTableClasses.cell).toContain("py-2")
  expect(authenticatedTableClasses.identifier).toContain("font-mono")
  expect(authenticatedTableClasses.identifier).toContain("truncate")
})

test("shared pagination copy is translated through catalog keys owned by no single feature", () => {
  expect(englishCatalog["common.pagination"]).toBe("Pagination")
  expect(englishCatalog["common.previous"]).toBe("Previous")
  expect(englishCatalog["common.next"]).toBe("Next")
})
