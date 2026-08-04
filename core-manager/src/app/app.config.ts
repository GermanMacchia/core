import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core'
import { provideRouter, withComponentInputBinding } from '@angular/router'
import { provideHttpClient, withInterceptors } from '@angular/common/http'
import { provideUiKit, ToastService, InfoModalService, ConfirmService, FilterService } from '@germanmacchia/angular-ui'
import { routes } from './app.routes'
import { authInterceptor } from './core/interceptors/auth.interceptor'

export const appConfig: ApplicationConfig = {
	providers: [
		provideBrowserGlobalErrorListeners(),
		provideRouter(routes, withComponentInputBinding()),
		provideHttpClient(withInterceptors([authInterceptor])),
		provideUiKit({ injectStyles: false }),
		ToastService,
		InfoModalService,
		ConfirmService,
		FilterService,
	],
}
