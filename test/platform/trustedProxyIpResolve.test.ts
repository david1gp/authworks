import { expect, test } from "bun:test"
import { trustedProxyIpResolve } from "../../src/platform/http/trustedProxyIpResolve.js"

test("trusted proxy resolution ignores forwarded headers from an untrusted peer", () => {
  expect(
    trustedProxyIpResolve({
      directAddress: "203.0.113.10",
      forwardedFor: "198.51.100.10, 203.0.113.20",
      trustedProxyAddresses: ["203.0.113.20"],
    }),
  ).toBe("203.0.113.10")
})

test("trusted proxy resolution selects the first untrusted address in the chain", () => {
  expect(
    trustedProxyIpResolve({
      directAddress: "203.0.113.20",
      forwardedFor: "198.51.100.10, 203.0.113.21",
      trustedProxyAddresses: ["203.0.113.20", "203.0.113.21"],
    }),
  ).toBe("198.51.100.10")
})

test("trusted proxy resolution normalizes bracketed IPv6 and host-port addresses", () => {
  expect(
    trustedProxyIpResolve({
      directAddress: "[2001:db8::20]:443",
      forwardedFor: "[2001:db8::10]:8443",
      trustedProxyAddresses: ["[2001:db8::20]"],
    }),
  ).toBe("2001:db8::10")
  expect(
    trustedProxyIpResolve({
      directAddress: "203.0.113.20:443",
      forwardedFor: "198.51.100.10:8443",
      trustedProxyAddresses: ["203.0.113.20"],
    }),
  ).toBe("198.51.100.10")
})
