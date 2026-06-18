import { bootstrapApplication } from '@angular/platform-browser'
import { appConfig } from './app/app.config'
import { App } from './app/app'
import cssText from './styles.css?inline'
import bootstrapIconsCss from 'bootstrap-icons/font/bootstrap-icons.css?inline'
import biWoff2Url from 'bootstrap-icons/font/fonts/bootstrap-icons.woff2?url'

if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
	if (!sessionStorage.getItem('shell_access_token')) {
		sessionStorage.setItem('shell_access_token', 'mock_token')
		sessionStorage.setItem('shell_user', JSON.stringify({
			id: '1',
			email: 'admin@example.com',
			role: 'superadmin',
			tenant_id: ''
		}))
	}
}

bootstrapApplication(App, appConfig)
	.then(async () => {
		const root = document.querySelector('app-root')
		const shadowRoot = root?.shadowRoot
		if (!shadowRoot) return

		// Font URLs in adoptedStyleSheets resolve against the document base URL, not the CSS
		// file location, so relative paths like ./fonts/... point nowhere. Register the font
		// globally using the Vite-served URL (?url gives us the correct dev-server path).
		if (!document.getElementById('manager-bi-fonts')) {
			const el = document.createElement('style')
			el.id = 'manager-bi-fonts'
			el.textContent = `@font-face { font-family: "bootstrap-icons"; src: url("${biWoff2Url}") format("woff2"); }`
			document.head.appendChild(el)
		}

		const iconsSheet = new CSSStyleSheet()
		const mainSheet = new CSSStyleSheet()
		await Promise.all([
			iconsSheet.replace(bootstrapIconsCss),
			mainSheet.replace(cssText),
		])
		shadowRoot.adoptedStyleSheets = [iconsSheet, mainSheet]
	})
	.catch(err => console.error(err))
