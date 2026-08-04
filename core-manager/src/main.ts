import { bootstrapApplication } from '@angular/platform-browser'
import { appConfig } from './app/app.config'
import { App } from './app/app'

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

bootstrapApplication(App, appConfig).catch(err => console.error(err))
