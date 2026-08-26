import { expect, test } from "bun:test"

const packageName = "@adaptive-ds/authworks"

type PackageJson = {
  readonly bin?: unknown
  readonly exports: Record<string, unknown>
  readonly main?: unknown
  readonly types?: unknown
}

test("build package-surface tests require post-build mode", () => {
  expect(process.env.AUTHWORKS_REQUIRE_BUILT_OUTPUTS).toBe("1")
})

test("built package declares both library and CLI entrypoints", async () => {
  const packageJson = (await Bun.file("dist/package.json").json()) as PackageJson
  const declaredPackageJson = (await Bun.file("package.json").json()) as PackageJson

  expect(packageJson.main).toBe("./dist/library/outputs/library.js")
  expect(packageJson.types).toBe("./dist/library/outputs/library.d.ts")
  expect(packageJson.bin).toEqual({ authworks: "./dist/cli/cli.js" })

  expect(packageJson.exports).toEqual(declaredPackageJson.exports)
  expect(Object.keys(packageJson.exports).some((key) => key.includes("*"))).toBe(false)

  for (const [exportKey, exportValue] of Object.entries(packageJson.exports)) {
    const targets = packageExportTargetsGet(exportValue)
    expect(targets.length, exportKey).toBeGreaterThan(0)
    for (const [, target] of targets) {
      expect(target.startsWith("./"), `${exportKey} target`).toBe(true)
      expect(await Bun.file(target.slice(2)).exists(), `${exportKey} target ${target}`).toBe(true)
    }

    const declarationTarget = packageExportDeclarationTargetGet(exportValue)
    if (declarationTarget !== undefined) {
      expect(declarationTarget.startsWith("./"), `${exportKey} declaration target`).toBe(true)
      expect(
        await Bun.file(declarationTarget.slice(2)).exists(),
        `${exportKey} declaration target ${declarationTarget}`,
      ).toBe(true)
    }

    if (exportKey !== "./package.json") {
      expect(packageExportImportTargetGet(exportValue), `${exportKey} import target`).toBeString()
    }
  }
})

test("every declared package export imports through consumer package resolution", async () => {
  const packageJson = (await Bun.file("dist/package.json").json()) as PackageJson
  const exportSpecifiers = Object.keys(packageJson.exports).map((exportKey) =>
    exportKey === "." ? packageName : `${packageName}${exportKey.slice(1)}`,
  )
  const script = `const specifiers = ${JSON.stringify(exportSpecifiers)}; await Promise.all(specifiers.map((specifier) => import(specifier)))`
  const result = await processRun(["bun", "-e", script])

  expect(result).toEqual({ exitCode: 0, stderr: "", stdout: "" })
})

test("built package blocks direct imports of feature internals", async () => {
  const internalPaths = [
    "features/users/actions/userCreate",
    "features/users/client/userApiClientCreate",
    "features/users/domain/userPublicViewCreate",
    "features/users/persistence/userRepositoryCreate",
    "features/users/server/userServerAppCreate",
    "features/account/actions/accountEffectiveAccessList",
    "features/account/client/accountApiClientCreate",
    "features/account/server/accountServerAppCreate",
    "features/admin/ui/adminApiCreate",
    "src/features/users/public/index",
    "src/features/account/public/index",
    "src/features/admin/ui/adminApiCreate",
  ]
  const script = `const paths = ${JSON.stringify(internalPaths)}; const results = await Promise.all(paths.map((path) => import(${JSON.stringify(packageName + "/")} + path).then(() => true, () => false))); if (results.some(Boolean)) process.exit(1)`
  const result = await processRun(["bun", "-e", script])

  expect(result).toEqual({ exitCode: 0, stderr: "", stdout: "" })
})

function packageExportImportTargetGet(exportValue: unknown): string | undefined {
  if (typeof exportValue === "string") return exportValue
  if (exportValue === null || typeof exportValue !== "object") return undefined
  const importTarget = (exportValue as Record<string, unknown>).import
  if (typeof importTarget === "string") return importTarget
  const defaultTarget = (exportValue as Record<string, unknown>).default
  return typeof defaultTarget === "string" ? defaultTarget : undefined
}

function packageExportDeclarationTargetGet(exportValue: unknown): string | undefined {
  if (exportValue === null || typeof exportValue !== "object") return undefined
  const declarationTarget = (exportValue as Record<string, unknown>).types
  return typeof declarationTarget === "string" ? declarationTarget : undefined
}

function packageExportTargetsGet(exportValue: unknown): readonly (readonly [string, string])[] {
  if (typeof exportValue === "string") return [["default", exportValue]]
  if (exportValue === null || typeof exportValue !== "object") return []
  return Object.entries(exportValue).flatMap(([condition, target]) =>
    typeof target === "string" && condition !== "types" ? [[condition, target]] : [],
  )
}

type ProcessResult = {
  readonly exitCode: number
  readonly stderr: string
  readonly stdout: string
}

async function processRun(args: readonly string[]): Promise<ProcessResult> {
  const child = Bun.spawn(Array.from(args), { stderr: "pipe", stdout: "pipe" })
  const [exitCode, stderr, stdout] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
    new Response(child.stdout).text(),
  ])
  return { exitCode, stderr, stdout }
}
