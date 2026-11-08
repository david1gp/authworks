import { describe, expect, test } from "bun:test"
import * as v from "valibot"
import { organizationSlugSchema } from "../public/organizationSlugSchema.js"
import { organizationSlugNormalize } from "./organizationSlugNormalize.js"

describe("organization slug normalize", () => {
  test("accepts a well-formed slug", () => {
    const normalized = organizationSlugNormalize("acme-corporation")
    expect(normalized.success).toBe(true)
    if (!normalized.success) throw new Error(normalized.errorMessage)
    expect(normalized.data).toBe("acme-corporation")
  })

  test("trims surrounding whitespace before validating", () => {
    const normalized = organizationSlugNormalize("  acme-2026  ")
    expect(normalized.success).toBe(true)
    if (!normalized.success) throw new Error(normalized.errorMessage)
    expect(normalized.data).toBe("acme-2026")
  })

  test("rejects malformed slugs", () => {
    for (const slug of ["Acme", "-acme", "acme-", "acme--corp", "acme_corp", "acme corp", "", "a".repeat(65)]) {
      const normalized = organizationSlugNormalize(slug)
      expect(normalized.success).toBe(false)
      if (normalized.success) throw new Error(`expected rejection for ${slug}`)
      expect(normalized.code).toBe("organizations.invalid")
      expect(v.safeParse(organizationSlugSchema, slug).success).toBe(false)
    }
  })

  test("rejects reserved slugs", () => {
    for (const slug of ["new", "unassigned"]) {
      const normalized = organizationSlugNormalize(slug)
      expect(normalized.success).toBe(false)
      if (normalized.success) throw new Error(`expected rejection for ${slug}`)
      expect(normalized.code).toBe("organizations.invalid")
      expect(v.safeParse(organizationSlugSchema, slug).success).toBe(false)
    }
  })

  test("schema accepts what normalize accepts", () => {
    for (const slug of ["acme", "acme-corporation", "a1-b2-c3", "a".repeat(64)]) {
      expect(organizationSlugNormalize(slug).success).toBe(true)
      expect(v.safeParse(organizationSlugSchema, slug).success).toBe(true)
    }
  })
})
