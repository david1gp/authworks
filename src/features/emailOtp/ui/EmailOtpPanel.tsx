import { Button } from "#ui/interactive/button/Button.jsx"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"

type EmailOtpPanelProps = {
  code: string
  email: string
  error?: string
  remainingSeconds: number
  step: "email" | "code"
  onBack: () => void
  onCode: (value: string) => void
  onEmail: (value: string) => void
  onResend: () => void
  onSubmit: (event: SubmitEvent) => void
}

export function EmailOtpPanel(props: EmailOtpPanelProps) {
  return (
    <section>
      <h1 class="text-2xl font-semibold">Sign in with email code</h1>
      {props.step === "email" ? (
        <form class="mt-6 grid gap-4" onSubmit={props.onSubmit}>
          <p class="text-muted-foreground">We’ll email you a one-time code.</p>
          <div class="grid gap-2">
            <Label for="otp-email">Email</Label>
            <Input
              id="otp-email"
              type="email"
              value={props.email}
              onInput={(event) => props.onEmail(event.currentTarget.value)}
            />
          </div>
          {props.error && (
            <p class="text-sm text-danger" role="alert">
              {props.error}
            </p>
          )}
          <Button variant="filledBlue" type="submit">
            Send code
          </Button>
        </form>
      ) : (
        <form class="mt-6 grid gap-4" onSubmit={props.onSubmit}>
          <p class="text-muted-foreground">Enter the six-digit code sent to {props.email}.</p>
          <div class="grid gap-2">
            <Label for="otp-code">Verification code</Label>
            <Input
              id="otp-code"
              inputmode="numeric"
              maxlength="6"
              value={props.code}
              onInput={(event) => props.onCode(event.currentTarget.value)}
            />
          </div>
          {props.error && (
            <p class="text-sm text-danger" role="alert">
              {props.error}
            </p>
          )}
          <Button variant="filledBlue" type="submit">
            Verify code
          </Button>
          <Button variant="link" type="button" disabled={props.remainingSeconds > 0} onClick={props.onResend}>
            {props.remainingSeconds > 0 ? `Resend in ${props.remainingSeconds}s` : "Resend code"}
          </Button>
        </form>
      )}
      <Button class="mt-3" variant="link" onClick={props.onBack}>
        Back to methods
      </Button>
    </section>
  )
}
