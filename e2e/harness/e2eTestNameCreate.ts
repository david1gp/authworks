export function e2eTestNameCreate(runId: string, suffix: string): string {
  const sanitized = suffix
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return `e2e-aw-${runId}-${sanitized === "" ? "unnamed" : sanitized}`
}
