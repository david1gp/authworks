import { Button } from "#ui/interactive/button/Button.jsx"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"

type PasswordResetPanelProps = {
  newPassword: string
  onNewPassword: (value: string) => void
  onSubmit: (event: SubmitEvent) => void
}

export function PasswordResetPanel(props: PasswordResetPanelProps) {
  return (
    <section>
      <h1 class="text-2xl font-semibold">Set a new password</h1>
      <form class="mt-6 grid gap-4" onSubmit={props.onSubmit}>
        <div class="grid gap-2">
          <Label for="reset-password">New password</Label>
          <Input
            id="reset-password"
            type="password"
            value={props.newPassword}
            onInput={(event) => props.onNewPassword(event.currentTarget.value)}
          />
        </div>
        <Button variant="filledBlue" type="submit">
          Complete reset
        </Button>
      </form>
    </section>
  )
}
