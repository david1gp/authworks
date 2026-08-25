import { expect, test } from "bun:test"

const packageName = "@adaptive-ds/authworks"

test("built package declares both library and CLI entrypoints", async () => {
  const packageFile = Bun.file("dist/package.json")
  if (!(await packageFile.exists())) return

  const packageJson = (await packageFile.json()) as {
    readonly bin?: unknown
    readonly exports?: Record<string, unknown>
    readonly main?: unknown
    readonly types?: unknown
  }

  expect(packageJson.main).toBe("./dist/library/outputs/library.js")
  expect(packageJson.types).toBe("./dist/library/outputs/library.d.ts")
  expect(packageJson.bin).toEqual({ authworks: "./dist/cli/cli.js" })

  const exports = packageJson.exports ?? {}
  expect(exports["."]).toBeDefined()
  expect(exports["./library"]).toBeDefined()
  expect(exports["./cli"]).toBeDefined()
  expect(exports["./server"]).toBeDefined()
  expect(Object.keys(exports).some((key) => key.includes("*"))).toBe(false)
})

test("built package blocks direct imports of feature internals", async () => {
  if (!(await Bun.file("dist/package.json").exists())) return

  const internalPaths = [
    "features/users/actions/userCreate",
    "features/users/client/userApiClientCreate",
    "features/users/domain/userPublicViewCreate",
    "features/users/persistence/userRepositoryCreate",
    "features/users/server/userServerAppCreate",
    "src/features/users/public/index",
  ]
  const script = `const paths = ${JSON.stringify(internalPaths)}; const results = await Promise.all(paths.map((path) => import(${JSON.stringify(packageName + "/")} + path).then(() => true, () => false))); if (results.some(Boolean)) process.exit(1)`
  const result = await processRun(["bun", "-e", script])

  expect(result).toEqual({ exitCode: 0, stderr: "", stdout: "" })
})

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
