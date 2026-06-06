import { ApplicationRef } from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'
import { APP_BASE_HREF } from '@angular/common'
import { appConfig } from './app/app.config'
import { App } from './app/app'

let appRef: ApplicationRef | null = null

export async function bootstrap(): Promise<void> {}

export async function mount(props: Record<string, unknown>): Promise<void> {
  const container =
    typeof props['domElementGetter'] === 'function'
      ? (props['domElementGetter'] as () => Element)()
      : document.getElementById('shell-content') ?? document.body

  const root = document.createElement('app-root')
  container.appendChild(root)

  appRef = await bootstrapApplication(App, {
    providers: [
      ...appConfig.providers,
      { provide: APP_BASE_HREF, useValue: '/manager' },
    ],
  })
}

export async function unmount(props: Record<string, unknown>): Promise<void> {
  appRef?.destroy()
  appRef = null

  const container =
    typeof props['domElementGetter'] === 'function'
      ? (props['domElementGetter'] as () => Element)()
      : document.getElementById('shell-content') ?? document.body
  container.innerHTML = ''
}
