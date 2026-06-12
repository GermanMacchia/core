import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http'
import { inject } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService } from '../services/auth.service'
import { catchError, switchMap, throwError, from } from 'rxjs'

export const authInterceptor: HttpInterceptorFn = (req, next) => {
	const auth   = inject(AuthService)
	const router = inject(Router)

	// Attach the Bearer token to every outgoing request.
	const token   = auth.accessToken()
	const authReq = token
		? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
		: req

	return next(authReq).pipe(
		catchError((err: HttpErrorResponse) => {
			// Only retry once for 401s on non-auth endpoints.
			if (err.status !== 401 || req.url.includes('/auth/')) {
				return throwError(() => err)
			}

			// Attempt a silent token refresh, then retry the original request.
			return from(auth.silentRefresh()).pipe(
				switchMap(success => {
					if (!success) {
						auth.clearTokens()
						router.navigate(['/login'])
						return throwError(() => err)
					}
					const retried = req.clone({
						setHeaders: { Authorization: `Bearer ${auth.accessToken()!}` },
					})
					return next(retried)
				}),
				catchError(() => {
					auth.clearTokens()
					router.navigate(['/login'])
					return throwError(() => err)
				}),
			)
		}),
	)
}
