import { Button } from "#ui/interactive/button/Button.jsx"

type MfaPanelProps = {
  onEmail: () => void
  onTotp: () => void
  onPasskey: () => void
  onBack: () => void
}

export function MfaPanel(props: MfaPanelProps) {
  return (
    <section>
      <h1 class="text-2xl font-semibold">2-Step Verification</h1>
      <p class="mt-2 text-muted-foreground">Choose how to verify your identity.</p>
      <div class="mt-6 grid gap-3">
        <Button variant="outline" onClick={props.onTotp}>
          Authenticator app
        </Button>
        <Button variant="outline" onClick={props.onEmail}>
          Email code
        </Button>
        <Button variant="outline" onClick={props.onPasskey}>
          Passkey
        </Button>
      </div>
      <Button class="mt-3" variant="link" onClick={props.onBack}>
        Back to methods
      </Button>
    </section>
  )
}
