import { useLocation, useNavigate } from "@solidjs/router"
import { createMemo } from "solid-js"
import { emailPreviewFixtures } from "../fixtures/emailPreviewFixtures.js"

export function emailDemoAppStateCreate() {
  const location = useLocation()
  const navigate = useNavigate()
  const fixture = createMemo(() => {
    const id = location.pathname.replace("/demo/emails/", "")
    return emailPreviewFixtures.find((candidate) => candidate.id === id)
  })

  return {
    fixture,
    go: (path: string) => navigate(path),
    isDirectory: () => location.pathname === "/demo/emails" || location.pathname === "/demo/emails/",
  }
}
