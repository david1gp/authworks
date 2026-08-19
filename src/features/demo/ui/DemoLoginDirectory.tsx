import { A } from "@solidjs/router"

const groups = [
  {
    name: "Chooser",
    scenarios: [
      ["chooser", "Method chooser"],
      ["chooser/recent-accounts", "Recent accounts"],
    ],
  },
  {
    name: "Email OTP",
    scenarios: [
      ["email-otp", "Request email code"],
      ["email-otp/code", "Verify email code"],
    ],
  },
  {
    name: "Password",
    scenarios: [
      ["password", "Password"],
      ["password/error", "Invalid credentials"],
      ["password/change-required", "Change required"],
    ],
  },
  {
    name: "Passkey",
    scenarios: [
      ["passkey", "Passkey"],
      ["passkey/unsupported", "Unsupported"],
    ],
  },
  {
    name: "External identity",
    scenarios: [
      ["idp", "Google"],
      ["idp/failure", "Failure"],
    ],
  },
  {
    name: "MFA",
    scenarios: [
      ["mfa", "Choose MFA"],
      ["mfa/totp", "TOTP"],
      ["mfa/email-otp", "Email OTP"],
      ["mfa/totp-enroll", "TOTP enroll"],
    ],
  },
  {
    name: "Recovery",
    scenarios: [
      ["password/forgot", "Request recovery"],
      ["password/forgot/sent", "Recovery sent"],
      ["password/reset", "Reset"],
      ["password/reset/complete", "Reset complete"],
    ],
  },
  {
    name: "Chrome",
    scenarios: [
      ["loading", "Loading"],
      ["unsupported", "Unsupported"],
    ],
  },
] as const

export function DemoLoginDirectory() {
  return (
    <div class="mx-auto max-w-5xl">
      <h1 class="text-3xl font-semibold">Login demo</h1>
      <p class="mt-2 text-muted-foreground">Choose a screen from the supported authentication flows.</p>
      <div class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <section class="rounded-xl border border-line bg-surface p-5">
            <h2 class="font-semibold">{group.name}</h2>
            <ul class="mt-3 grid gap-2">
              {group.scenarios.map(([path, label]) => (
                <li>
                  <A class="text-accent hover:underline" href={`/demo/login/${path}`}>
                    {label}
                  </A>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
