import { describe, expect, test } from "bun:test"
import { directoryTeamSlugSuggest } from "./directoryTeamSlugSuggest.js"

describe("directory team slug suggest", () => {
  test("builds a slug from a plain team name", () => {
    expect(directoryTeamSlugSuggest("Platform Team")).toBe("platform-team")
  })

  test("collapses runs of separators and trims edge hyphens", () => {
    expect(directoryTeamSlugSuggest("  Growth & Ops -- 2026 ")).toBe("growth-ops-2026")
  })

  test("drops characters outside the slug alphabet", () => {
    expect(directoryTeamSlugSuggest("Équipe Alpha")).toBe("quipe-alpha")
  })

  test("caps the suggestion at 64 characters without a trailing hyphen", () => {
    const suggested = directoryTeamSlugSuggest(`${"a".repeat(60)} ${"b".repeat(10)}`)
    expect(suggested.length).toBeLessThanOrEqual(64)
    expect(suggested.endsWith("-")).toBe(false)
  })

  test("returns an empty suggestion when nothing usable remains", () => {
    expect(directoryTeamSlugSuggest("---")).toBe("")
    expect(directoryTeamSlugSuggest("")).toBe("")
  })
})
