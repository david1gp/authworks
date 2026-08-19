import { Button } from "#ui/interactive/button/Button.jsx"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"

type MfaEmailOtpPanelProps = {
  code: string
  error?: string
  onBack: () => void
  onCode: (value: string) => void
  onSubmit: (event: SubmitEvent) => void
}

export function MfaEmailOtpPanel(props: MfaEmailOtpPanelProps) {
  return (
    <section>
      <h1 class="text-2xl font-semibold">Email verification code</h1>
      <p class="mt-2 text-muted-foreground">Enter the six-digit code sent to your email.</p>
      <form class="mt-6 grid gap-4" onSubmit={props.onSubmit}>
        <div class="grid gap-2">
          <Label for="mfa-email-code">Verification code</Label>
          <Input
            id="mfa-email-code"
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
          Verify
        </Button>
      </form>
      <Button class="mt-3" variant="link" onClick={props.onBack}>
        Back to verification methods
      </Button>
    </section>
  )
}
