import { expect, test } from "bun:test"
import { productionLoginRedirectUrlCreate } from "../../../ui/production/productionLoginRedirectUrlCreate.js"
import { loginReturnPathSelect } from "../../login/model/loginReturnPathSelect.js"
import { directoryInvitationLinkCreate } from "./directoryInvitationLinkCreate.js"

test("invitation links use the app origin and the appropriate production or demo route", () => {
  expect(directoryInvitationLinkCreate("https://auth.example/admin", "a+b/& ?#", false)).toBe(
    "https://auth.example/invitations/accept?token=a%2Bb%2F%26+%3F%23",
  )
  expect(directoryInvitationLinkCreate("https://auth.example", "demo", true)).toBe(
    "https://auth.example/demo/invitations/accept?token=demo",
  )
})

test("anonymous authentication return paths preserve the encoded invitation link", () => {
  const link = new URL(directoryInvitationLinkCreate("https://auth.example", "a+b/& ?#", false))
  const redirect = new URL(productionLoginRedirectUrlCreate(link), link.origin)
  const returnTo = redirect.searchParams.get("return_to")
  expect(returnTo).toBe(`${link.pathname}${link.search}`)
  expect(loginReturnPathSelect(returnTo, "/account")).toBe(`${link.pathname}${link.search}`)
})
