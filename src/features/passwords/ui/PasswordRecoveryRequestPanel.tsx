import { Button } from "#ui/interactive/button/Button.jsx"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"

type PasswordRecoveryRequestPanelProps = {
  email: string
  error?: string
  onBack: () => void
  onEmail: (value: string) => void
  onSubmit: (event: SubmitEvent) => void
}

export function PasswordRecoveryRequestPanel(props: PasswordRecoveryRequestPanelProps) {
  return (
    <section>
      <h1 class="text-2xl font-semibold">Reset your password</h1>
      <p class="mt-2 text-muted-foreground">Enter your email and we’ll send next steps if an account matches.</p>
      <form class="mt-6 grid gap-4" onSubmit={props.onSubmit}>
        <div class="grid gap-2">
          <Label for="recovery-email">Email</Label>
          <Input
            id="recovery-email"
            type="email"
            value={props.email}
            autocomplete="email"
            onInput={(event) => props.onEmail(event.currentTarget.value)}
          />
        </div>
        {props.error && (
          <p class="text-sm text-danger" role="alert">
            {props.error}
          </p>
        )}
        <Button variant="filledBlue" type="submit">
          Send recovery email
        </Button>
      </form>
      <Button class="mt-3" variant="link" onClick={props.onBack}>
        Back to password
      </Button>
    </section>
  )
}
