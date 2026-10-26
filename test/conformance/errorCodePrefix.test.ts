import { expect, test } from "bun:test"
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

// Error-code namespacing: a resultError*Create call in
// src/features/<feature>/actions or .../server must create a code owned by
// that feature (prefix matches the feature's own error catalog).
//
// Documented exceptions (creations, not branch comparisons — comparisons
// against another feature's code, such as the realms.unauthorized branches in
// the events and users server apps, are reads and never match this scan):
// - authorization.* anywhere: authorization is the shared cross-cutting
//   policy feature; impersonation, realms, and machine users surface its
//   decisions directly instead of renaming them.
// - sessions.assurance-required in organizations: the organization switch
//   surfaces the session step-up requirement; both organization admin UIs
//   already handle the sessions and organizations variants.
// - users.not-found in projects: a project user assignment references a user,
//   so a missing user surfaces the users code.
// - platform.configuration-invalid in emailOtp, passwords, whatsappOtp:
//   rate limiting requires a deployment secret, and a missing secret is a
//   platform deployment failure rather than feature-domain input.
const codeExceptionAllow = new Map<string, readonly string[]>([
  ["authorization", []],
  ["sessions.assurance-required", ["organizations"]],
  ["users.not-found", ["projects"]],
  ["platform.configuration-invalid", ["emailOtp", "passwords", "whatsappOtp"]],
])

const codedCreatePattern =
  /(?:resultErrorCodedCreate|resultErrorCreate)\(\s*[A-Za-z_$][\w$]*\s*,\s*"(?:[^"\\]|\\.)*"\s*,\s*"([a-z][a-z0-9-]*\.[a-z0-9-]+)"/gs

test("feature actions and servers create only their own error codes", async () => {
  const catalogPrefixes = await featureCodePrefixes()
  const violations: string[] = []
  for (const feature of await featureDirectories()) {
    const allowed = catalogPrefixes.get(feature) ?? new Set<string>()
    for (const filePath of await scopeFiles(feature)) {
      const source = await readFile(filePath, "utf8")
      for (const match of source.matchAll(codedCreatePattern)) {
        const code = match[1]
        if (code === undefined) continue
        const prefix = code.slice(0, code.indexOf("."))
        if (allowed.has(prefix)) continue
        const exceptionFeatures = codeExceptionAllow.get(prefix) ?? codeExceptionAllow.get(code)
        if (exceptionFeatures !== undefined && (exceptionFeatures.length === 0 || exceptionFeatures.includes(feature)))
          continue
        violations.push(`${filePath}: ${code}`)
      }
    }
  }
  expect(violations).toEqual([])
})

async function featureDirectories(): Promise<string[]> {
  const entries = await readdir(join(process.cwd(), "src/features"), { withFileTypes: true })
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
}

async function scopeFiles(feature: string): Promise<string[]> {
  const files: string[] = []
  for (const scope of ["actions", "server"]) {
    try {
      files.push(...(await filesWalk(join(process.cwd(), "src/features", feature, scope))))
    } catch (_error) {
      continue
    }
  }
  return files.filter((filePath) => filePath.endsWith(".ts") && !filePath.endsWith(".test.ts"))
}

async function featureCodePrefixes(): Promise<Map<string, Set<string>>> {
  const prefixes = new Map<string, Set<string>>()
  for (const feature of await featureDirectories()) {
    const collected = new Set<string>()
    let catalogDirectory: string[]
    try {
      catalogDirectory = await filesWalk(join(process.cwd(), "src/features", feature, "errors"))
    } catch (_error) {
      prefixes.set(feature, collected)
      continue
    }
    for (const filePath of catalogDirectory.filter((filePath) => filePath.endsWith("ErrorCatalog.ts"))) {
      const source = await readFile(filePath, "utf8")
      for (const match of source.matchAll(/"([a-z][a-z0-9-]*)\.[a-z0-9-]+"/g)) {
        if (match[1] !== undefined) collected.add(match[1])
      }
    }
    prefixes.set(feature, collected)
  }
  return prefixes
}

async function filesWalk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const filePath = join(directory, entry.name)
      if (entry.isDirectory()) return filesWalk(filePath)
      return [filePath]
    }),
  )
  return nested.flat()
}
