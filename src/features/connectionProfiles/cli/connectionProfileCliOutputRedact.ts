export function connectionProfileCliOutputRedact(
  output: string,
  secrets: readonly (string | undefined)[] = [],
): string {
  return secrets
    .filter((secret): secret is string => secret !== undefined && secret.length > 0)
    .reduce((redacted, secret) => redacted.replaceAll(secret, "[REDACTED]"), output)
}
