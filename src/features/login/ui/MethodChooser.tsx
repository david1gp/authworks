import { For } from "solid-js"
import { MethodChoiceButton } from "./MethodChoiceButton.js"

type MethodChooserProps = {
  methods: Array<"password" | "email-otp" | "passkey" | "external-identity">
  onSelect: (method: "password" | "email-otp" | "passkey" | "external-identity") => void
}

export function MethodChooser(props: MethodChooserProps) {
  return (
    <section aria-labelledby="login-title">
      <h1 id="login-title" class="text-2xl font-semibold">
        Choose a method
      </h1>
      <p class="mt-2 text-muted-foreground">Sign in to Acme with one of the available methods.</p>
      <div class="mt-6 grid gap-3">
        <For each={props.methods}>
          {(method) => (
            <MethodChoiceButton
              method={method}
              label={
                method === "external-identity"
                  ? "Continue with Google"
                  : method === "email-otp"
                    ? "Email code"
                    : method === "passkey"
                      ? "Passkey"
                      : "Password"
              }
              detail={
                method === "external-identity"
                  ? "Use your Google account"
                  : method === "email-otp"
                    ? "Receive a one-time code"
                    : method === "passkey"
                      ? "Use a secure device credential"
                      : "Use your account password"
              }
              onClick={() => props.onSelect(method)}
            />
          )}
        </For>
      </div>
    </section>
  )
}
