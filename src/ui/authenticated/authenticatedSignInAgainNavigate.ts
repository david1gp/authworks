/**
 * Returns to the login page with the current destination as `return_to`, so an
 * assurance-required screen can offer a way forward instead of a dead end.
 */
export function authenticatedSignInAgainNavigate(): void {
  if (typeof window === "undefined") return
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`
  window.location.href = `/login?return_to=${encodeURIComponent(returnTo)}`
}
