import { inject } from '@angular/core'
import { CanActivateFn, Router } from '@angular/router'
import { AuthService } from '../services/auth.service'

export const superAdminGuard: CanActivateFn = () => {
	const auth = inject(AuthService)
	const router = inject(Router)

	if (!auth.isAuthenticated()) return router.createUrlTree(['/login'])

	const user = auth.currentUser()
	if (user?.role === 'superadmin') return true

	return router.createUrlTree(['/'])
}
