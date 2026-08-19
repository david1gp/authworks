import { Button } from "#ui/interactive/button/Button.jsx"

type MfaWebAuthnEnrollPanelProps = {
  onBack: () => void
  onComplete: () => void
}

export function MfaWebAuthnEnrollPanel(props: MfaWebAuthnEnrollPanelProps) {
  return (
    <section>
      <h1 class="text-2xl font-semibold">Set up a passkey</h1>
      <p class="mt-3 text-muted-foreground">Register a passkey on this device for stronger two-step verification.</p>
      <Button class="mt-6 w-full" variant="filledBlue" onClick={props.onComplete}>
        Register passkey
      </Button>
      <Button class="mt-3 w-full" variant="link" onClick={props.onBack}>
        Back to verification methods
      </Button>
    </section>
  )
}
