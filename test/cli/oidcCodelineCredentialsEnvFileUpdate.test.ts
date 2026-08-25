import { expect, test } from "bun:test"
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { oidcCodelineCredentialsEnvFileClientIdGet } from "../../src/features/oidc/cli/oidcCodelineCredentialsEnvFileClientIdGet.js"
import { oidcCodelineCredentialsEnvFileUpdate } from "../../src/features/oidc/cli/oidcCodelineCredentialsEnvFileUpdate.js"

test("Codeline credential env updates write all six aliases for ensure and rotation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-codeline-credentials-env-"))
  const path = join(directory, ".env")
  try {
    await writeFile(path, "# preserved\nOTHER=value\n", { mode: 0o600 })

    const ensured = await oidcCodelineCredentialsEnvFileUpdate({
      clientId: "ensure-client-id",
      clientSecret: "ensure-client-secret",
      path,
    })
    expect(ensured.success).toBe(true)
    expect(ensured.success ? ensured.data.aliases : []).toEqual([
      "OIDC_AUTHWORKS_CLIENT_ID",
      "OIDC_AUTHWORKS_CLIENT_SECRET",
      "OIDC_CLIENT_ID",
      "OIDC_CLIENT_SECRET",
      "ZITADEL_CLIENT_ID",
      "ZITADEL_CLIENT_SECRET",
    ])
    expect((await stat(path)).mode & 0o777).toBe(0o600)

    const rotated = await oidcCodelineCredentialsEnvFileUpdate({
      clientId: "rotated-client-id",
      clientSecret: "rotated-client-secret",
      path,
    })
    expect(rotated.success).toBe(true)
    const content = await readFile(path, "utf8")
    for (const name of ["OIDC_AUTHWORKS_CLIENT_ID", "OIDC_CLIENT_ID", "ZITADEL_CLIENT_ID"])
      expect(content).toContain(`${name}=rotated-client-id`)
    for (const name of ["OIDC_AUTHWORKS_CLIENT_SECRET", "OIDC_CLIENT_SECRET", "ZITADEL_CLIENT_SECRET"])
      expect(content).toContain(`${name}=rotated-client-secret`)
    expect(content).toContain("OTHER=value")
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

test("Codeline credential env updates refuse duplicate aliases without changing the file", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-codeline-credentials-duplicate-"))
  const path = join(directory, ".env")
  const original = "OIDC_AUTHWORKS_CLIENT_ID=first\nOIDC_AUTHWORKS_CLIENT_ID=second\n"
  try {
    await writeFile(path, original, { mode: 0o600 })
    const result = await oidcCodelineCredentialsEnvFileUpdate({
      clientId: "new-client-id",
      clientSecret: "new-client-secret",
      path,
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.code).toBe("oidc.conflict")
    expect(await readFile(path, "utf8")).toBe(original)

    const lookup = await oidcCodelineCredentialsEnvFileClientIdGet(path)
    expect(lookup.success).toBe(false)
    if (!lookup.success) expect(lookup.code).toBe("oidc.conflict")
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})
