import { Component, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService } from '../../core/services/auth.service'
import { AuthTokens, AuthUser } from '../../core/models/tenant.model'

@Component({
	selector: 'app-auth-callback',
	standalone: true,
	template: `
		<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui">
			<p style="color:#64748b;font-size:0.9rem">Iniciando sesión…</p>
		</div>
	`,
})
export class AuthCallbackComponent implements OnInit {
	constructor(
		private auth: AuthService,
		private router: Router,
	) {}

	ngOnInit(): void {
		const hash = window.location.hash.slice(1)
		const params = new URLSearchParams(hash)
		const at = params.get('at')
		const rt = params.get('rt')

		if (!at || !rt) {
			this.router.navigate(['/login'])
			return
		}

		try {
			// Decodificar payload del JWT (base64url → base64 estándar)
			const b64 = at.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
			const payload = JSON.parse(atob(b64))

			let user: AuthUser
			const userEnc = params.get('u')
			if (userEnc) {
				user = JSON.parse(atob(decodeURIComponent(userEnc)))
			} else {
				user = {
					id:        payload.sub,
					email:     '',
					role:      payload.role,
					tenant_id: payload.tenant_id,
				}
			}

			const tokens: AuthTokens = {
				access_token:  at,
				refresh_token: rt,
				expires_at:    new Date(payload.exp * 1000).toISOString(),
				user,
			}

			this.auth.setTokens(tokens)

			// Limpiar tokens de la URL del historial
			history.replaceState(null, '', window.location.pathname)

			this.router.navigate(['/'])
		} catch {
			this.router.navigate(['/login'])
		}
	}
}
