import { Button } from "#ui/interactive/button/Button.jsx"
import { Checkbox } from "#ui/input/check/Checkbox.jsx"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"

type PasswordPanelProps = {
  error?: string
  identifier: string
  password: string
  rememberIdentifier: boolean
  revealPassword: boolean
  onBack: () => void
  onIdentifier: (value: string) => void
  onPassword: (value: string) => void
  onRememberIdentifier: (checked: boolean) => void
  onRevealPassword: () => void
  onSubmit: (event: SubmitEvent) => void
  onForgot: () => void
}

export function PasswordPanel(props: PasswordPanelProps) {
  return (
    <section>
      <h1 class="text-2xl font-semibold">Sign in with password</h1>
      <p class="mt-2 text-muted-foreground">Enter your Acme account details.</p>
      <form class="mt-6 grid gap-4" onSubmit={props.onSubmit} novalidate>
        <div class="grid gap-2">
          <Label for="identifier">Email or username</Label>
          <Input
            id="identifier"
            value={props.identifier}
            autocomplete="username"
            onInput={(event) => props.onIdentifier(event.currentTarget.value)}
          />
        </div>
        <div class="grid gap-2">
          <Label for="password">Password</Label>
          <div class="flex gap-2">
            <Input
              id="password"
              class="min-w-0 flex-1"
              type={props.revealPassword ? "text" : "password"}
              value={props.password}
              autocomplete="current-password"
              onInput={(event) => props.onPassword(event.currentTarget.value)}
            />
            <Button variant="ghost" type="button" onClick={props.onRevealPassword}>
              {props.revealPassword ? "Hide" : "Show"}
            </Button>
          </div>
        </div>
        <Checkbox id="remember-identifier" checked={props.rememberIdentifier} onChange={props.onRememberIdentifier}>
          Remember identifier
        </Checkbox>
        {props.error && (
          <p class="text-sm text-danger" role="alert">
            {props.error}
          </p>
        )}
        <Button type="submit" variant="filledBlue" class="w-full">
          Sign in
        </Button>
      </form>
      <div class="mt-4 flex justify-between gap-3">
        <Button variant="link" onClick={props.onForgot}>
          Forgot password?
        </Button>
        <Button variant="link" onClick={props.onBack}>
          Back to methods
        </Button>
      </div>
    </section>
  )
}
