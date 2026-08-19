export function demoResourceIdGenerate(): string {
  const uuid = crypto.randomUUID()
  return `${uuid.slice(0, 14)}7${uuid.slice(15, 19)}8${uuid.slice(20)}`
}
