import { Button } from "#ui/interactive/button/Button.jsx"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"

type PasswordChangeRequiredPanelProps = {
  newPassword: string
  onBack: () => void
  onNewPassword: (value: string) => void
  onSubmit: (event: SubmitEvent) => void
}

export function PasswordChangeRequiredPanel(props: PasswordChangeRequiredPanelProps) {
  return (
    <section>
      <h1 class="text-2xl font-semibold">Choose a new password</h1>
      <p class="mt-2 text-muted-foreground">Your administrator requires a password change before continuing.</p>
      <form class="mt-6 grid gap-4" onSubmit={props.onSubmit}>
        <div class="grid gap-2">
          <Label for="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            value={props.newPassword}
            onInput={(event) => props.onNewPassword(event.currentTarget.value)}
          />
        </div>
        <Button variant="filledBlue" type="submit">
          Update password
        </Button>
      </form>
      <Button class="mt-3" variant="link" onClick={props.onBack}>
        Back to methods
      </Button>
    </section>
  )
}
