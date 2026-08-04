// Registrar el custom element <login-mfe> como efecto secundario.
import './Login.svelte'

let element: HTMLElement | null = null
let listeners: Array<{ name: string; fn: EventListener }> = []

export async function bootstrap(): Promise<void> {}

export async function mount(props: Record<string, unknown>): Promise<void> {
  const target =
    typeof props.domElementGetter === 'function'
      ? (props.domElementGetter as () => Element)()
      : (document.getElementById('shell-content') ?? document.body)

  const tenant = props.tenant as { name?: string; primary_color?: string } | undefined
  const config = JSON.stringify({
    name:          tenant?.name ?? 'Platform',
    primary_color: tenant?.primary_color,
    auth_url:      props.authApiUrl as string,
  })

  element = document.createElement('login-mfe')
  element.setAttribute('config', config)
  target.appendChild(element)

  const onSuccess = ((e: Event) => {
    const tokens = (e as CustomEvent).detail
    ;(props.onLogin as (t: unknown) => void)?.(tokens)
  }) as EventListener

  element.addEventListener('loginsuccess', onSuccess)
  listeners = [{ name: 'loginsuccess', fn: onSuccess }]
}

export async function unmount(): Promise<void> {
  for (const { name, fn } of listeners) {
    element?.removeEventListener(name, fn)
  }
  listeners = []
  element?.parentNode?.removeChild(element)
  element = null
}
