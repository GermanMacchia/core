import {
	ApplicationConfig,
	APP_INITIALIZER,
	provideBrowserGlobalErrorListeners,
} from '@angular/core'
import { provideRouter, withComponentInputBinding } from '@angular/router'
import { provideHttpClient } from '@angular/common/http'
import { routes } from './app.routes'
import { TenantService } from './core/services/tenant.service'

function initTenant(tenant: TenantService) {
	return () => tenant.loadConfig()
}

export const appConfig: ApplicationConfig = {
	providers: [
		provideBrowserGlobalErrorListeners(),
		provideRouter(routes, withComponentInputBinding()),
		provideHttpClient(),
		{
			provide: APP_INITIALIZER,
			useFactory: initTenant,
			deps: [TenantService],
			multi: true,
		},
	],
}
