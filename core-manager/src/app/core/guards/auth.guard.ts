import { APP_BASE_HREF } from '@angular/common'
import { inject } from '@angular/core'
import { CanActivateFn, Router } from '@angular/router'
import { AuthService } from '../services/auth.service'

export const authGuard: CanActivateFn = (_route, state) => {
	const auth     = inject(AuthService)
	const router   = inject(Router)
	const baseHref = inject(APP_BASE_HREF, { optional: true }) ?? '/manager'

	if (!auth.isAuthenticated()) {
		// When running inside the shell, delegate to the centralized login MFE
		// so the user gets a true SSO flow instead of the manager's own login page.
		const isInShell = typeof (window as any).__SHELL_CONTEXT__?.serviceId !== 'undefined'
		if (isInShell) {
			const prefix     = baseHref === '/' ? '' : baseHref
			const returnPath = `${prefix}${state.url === '/' ? '' : state.url}`
			// history.pushState is intercepted by single-spa, triggering a routing change.
			history.pushState(null, '', `/login?return=${encodeURIComponent(returnPath)}`)
			return false
		}
		return router.createUrlTree(['/login'])
	}

	// Enforce the services claim: the JWT lists which service UUIDs this user may
	// access. An empty list means no restriction (superadmin tokens always have nil).
	const serviceId    = (window as any).__SHELL_CONTEXT__?.serviceId as string | undefined
	const userServices = auth.getServices()
	if (serviceId && userServices.length > 0 && !userServices.includes(serviceId)) {
		return router.createUrlTree(['/'])
	}

	return true
}
