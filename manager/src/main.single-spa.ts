import { APP_BASE_HREF } from '@angular/common'
import { ApplicationRef } from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'
import { App } from './app/app'
import { appConfig } from './app/app.config'
import bootstrapIconsCss from 'bootstrap-icons/font/bootstrap-icons.css?inline'
import cssText from './styles.css?inline'

let appRef: ApplicationRef | null = null

export async function bootstrap(): Promise<void> {}

export async function mount(props: Record<string, unknown>): Promise<void> {
	const existing = (window as any).__SHELL_CONTEXT__ ?? {}
	const ctx: Record<string, unknown> = {
		...existing,
		authApiUrl: props['authApiUrl'] ?? existing.authApiUrl ?? 'http://localhost:8081',
	}
	// Only set serviceId when the shell explicitly provides it.
	// Defaulting to null would make typeof serviceId === 'object', which the
	// authGuard's isInShell check treats as "running inside the shell" and
	// redirects to the shell login URL instead of the manager's own /login.
	if (props['serviceId'] !== undefined) ctx['serviceId'] = props['serviceId']
	;(window as any).__SHELL_CONTEXT__ = ctx

	const container =
		typeof props['domElementGetter'] === 'function'
			? (props['domElementGetter'] as () => Element)()
			: (document.getElementById('shell-content') ?? document.body)

	const root = document.createElement('app-root')
	root.setAttribute('data-theme', 'cupcake')
	container.appendChild(root)

	const basePath = typeof props['basePath'] === 'string' ? props['basePath'] : '/manager'
	appRef = await bootstrapApplication(App, {
		providers: [...appConfig.providers, { provide: APP_BASE_HREF, useValue: basePath }],
	})

	const shadowRoot = root.shadowRoot
	if (shadowRoot) {
		// @font-face in adoptedStyleSheets has cross-origin URL issues in dev (Vite resolves
		// url() to server-relative paths that the shell resolves against its own origin) and
		// browser inconsistencies. Fix: register the font-face globally in document.head
		// with URLs prefixed by the MFE's origin, then shadow DOM elements can use the font.
		if (!document.getElementById('manager-bi-fonts')) {
			const mfeOrigin = new URL(import.meta.url).origin
			const fixUrl = (css: string) =>
				css.replace(/url\((["']?)(\/[^)"']+)\1\)/g, (_, q, p) => `url(${q}${mfeOrigin}${p}${q})`)
			const fontFaces = bootstrapIconsCss.match(/@font-face\s*\{[^}]+\}/g)?.join('\n') ?? ''
			const el = document.createElement('style')
			el.id = 'manager-bi-fonts'
			el.textContent = fixUrl(fontFaces)
			document.head.appendChild(el)
		}

		const sheet = new CSSStyleSheet()
		await sheet.replace(bootstrapIconsCss + '\n' + cssText)
		shadowRoot.adoptedStyleSheets = [sheet]
	}
}

export async function unmount(props: Record<string, unknown>): Promise<void> {
	appRef?.destroy()
	appRef = null

	const container =
		typeof props['domElementGetter'] === 'function'
			? (props['domElementGetter'] as () => Element)()
			: (document.getElementById('shell-content') ?? document.body)
	container.innerHTML = ''
}
