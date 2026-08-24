import { useLocation, useNavigate } from "@solidjs/router"
import { createMemo } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { emailPreviewFixtures } from "../fixtures/emailPreviewFixtures.js"

export function emailDemoAppStateCreate() {
  const location = useLocation()
  const navigate = useNavigate()
  const compact = createSignalObject(false)

  const fixture = createMemo(() => {
    const pathname = location.pathname
    if (pathname === "/demo/emails" || pathname === "/demo/emails/") return undefined
    const id = pathname.replace(/^\/demo\/emails\/?/, "").replace(/\/$/, "")
    return emailPreviewFixtures.find((candidate) => candidate.id === id)
  })

  return {
    fixture,
    go: (path: string) => navigate(path),
    isCompact: () => compact.get(),
    isDirectory: () => location.pathname === "/demo/emails" || location.pathname === "/demo/emails/",
    toggleCompact: () => compact.set(!compact.get()),
  }
}
