import { expect, test } from "bun:test"
import { authenticatedAvatarColorGet } from "../../src/ui/authenticated/authenticatedAvatarColorGet.js"
import { authenticatedInitialsGet } from "../../src/ui/authenticated/authenticatedInitialsGet.js"

test("initials use the first letters of the first and last name parts", () => {
  expect(authenticatedInitialsGet("Ada Lovelace")).toBe("AL")
  expect(authenticatedInitialsGet("ada")).toBe("A")
  expect(authenticatedInitialsGet("  Jean-Luc   Picard  ")).toBe("JP")
  expect(authenticatedInitialsGet("李雷")).toBe("李")
})

test("blank names fall back to a placeholder mark", () => {
  expect(authenticatedInitialsGet("")).toBe("?")
  expect(authenticatedInitialsGet("   ")).toBe("?")
})

test("avatar colors are deterministic and stay inside the token palette", () => {
  const first = authenticatedAvatarColorGet("Ada Lovelace")
  expect(authenticatedAvatarColorGet("Ada Lovelace")).toBe(first)
  expect(authenticatedAvatarColorGet("")).toBeTruthy()
  for (const seed of ["Ada Lovelace", "Grace Hopper", "Alan Turing", ""]) {
    const classes = authenticatedAvatarColorGet(seed)
    expect(classes).toMatch(/^bg-(accent|danger|success|warning|muted)/)
    expect(classes).toMatch(/ text-(accent|danger|success|warning|muted-foreground)$/)
  }
  const distinct = new Set(
    ["Ada Lovelace", "Grace Hopper", "Alan Turing", "Katherine Johnson"].map((seed) =>
      authenticatedAvatarColorGet(seed),
    ),
  )
  expect(distinct.size).toBeGreaterThan(1)
})
