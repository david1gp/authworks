import { describe, expect, test } from "bun:test"
import { organizationSlugNormalize } from "./organizationSlugNormalize.js"
import { organizationSlugSuggest } from "./organizationSlugSuggest.js"

describe("organization slug suggest", () => {
  test("builds a slug from a plain organization name", () => {
    expect(organizationSlugSuggest("Acme Corporation")).toBe("acme-corporation")
  })

  test("collapses runs of separators and trims edge hyphens", () => {
    expect(organizationSlugSuggest("  Growth & Ops -- 2026 ")).toBe("growth-ops-2026")
  })

  test("drops characters outside the slug alphabet", () => {
    expect(organizationSlugSuggest("Équipe Alpha")).toBe("quipe-alpha")
  })

  test("caps the suggestion at 64 characters without a trailing hyphen", () => {
    const suggested = organizationSlugSuggest(`${"a".repeat(60)} ${"b".repeat(10)}`)
    expect(suggested.length).toBeLessThanOrEqual(64)
    expect(suggested.endsWith("-")).toBe(false)
  })

  test("falls back to organization when nothing usable remains", () => {
    expect(organizationSlugSuggest("---")).toBe("organization")
    expect(organizationSlugSuggest("")).toBe("organization")
  })

  test("falls back to organization for reserved slugs", () => {
    expect(organizationSlugSuggest("new")).toBe("organization")
    expect(organizationSlugSuggest("unassigned")).toBe("organization")
    expect(organizationSlugSuggest(" New ")).toBe("organization")
  })

  test("every suggestion passes organization slug validation", () => {
    for (const name of [
      "Acme Corporation",
      "  Growth & Ops -- 2026 ",
      "Équipe Alpha",
      "---",
      "",
      "new",
      "a".repeat(200),
    ]) {
      const suggested = organizationSlugSuggest(name)
      const normalized = organizationSlugNormalize(suggested)
      expect(normalized.success).toBe(true)
    }
  })
})
