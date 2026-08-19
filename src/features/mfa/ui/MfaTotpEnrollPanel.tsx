import { Button } from "#ui/interactive/button/Button.jsx"
import { CodeBlock } from "#ui/static/code/CodeBlock.jsx"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"

type MfaTotpEnrollPanelProps = {
  code: string
  error?: string
  onBack: () => void
  onCode: (value: string) => void
  onSubmit: (event: SubmitEvent) => void
}

export function MfaTotpEnrollPanel(props: MfaTotpEnrollPanelProps) {
  return (
    <section>
      <h1 class="text-2xl font-semibold">Set up an authenticator</h1>
      <p class="mt-2 text-muted-foreground">
        Add this secret to your authenticator app, then enter the generated code.
      </p>
      <CodeBlock class="mt-5" data="JBSWY3DPEHPK3PXP" />
      <form class="mt-5 grid gap-4" onSubmit={props.onSubmit}>
        <div class="grid gap-2">
          <Label for="mfa-enroll-code">Verification code</Label>
          <Input
            id="mfa-enroll-code"
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
          Finish setup
        </Button>
      </form>
      <Button class="mt-3" variant="link" onClick={props.onBack}>
        Back to verification methods
      </Button>
    </section>
  )
}
