export function connectionProfileCliProfileFlag() {
  return {
    brief: "Connection profile name",
    kind: "parsed" as const,
    optional: true as const,
    parse: (value: string) => value,
    placeholder: "NAME",
  }
}
