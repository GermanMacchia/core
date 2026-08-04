import { Injectable, signal, computed } from '@angular/core'
import { AuthTokens, AuthUser } from '../models/tenant.model'

// Keys are shared with the shell so a single session covers all MFEs.
const ACCESS_KEY  = 'shell_access_token'
const REFRESH_KEY = 'shell_refresh_token'
const USER_KEY    = 'shell_user'

function decodeUserFromJwt(token: string | null): AuthUser | null {
	if (!token) return null
	try {
		const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
		const p = JSON.parse(atob(b64))
		return { id: p.sub ?? '', email: p.email ?? '', role: p.role ?? '', tenant_id: p.tenant_id ?? '' }
	} catch {
		return null
	}
}

@Injectable({ providedIn: 'root' })
export class AuthService {
	private readonly _token = signal<string | null>(sessionStorage.getItem(ACCESS_KEY))
	private readonly _user  = signal<AuthUser | null>(
		JSON.parse(sessionStorage.getItem(USER_KEY) ?? 'null') ??
		decodeUserFromJwt(sessionStorage.getItem(ACCESS_KEY)),
	)

	readonly isAuthenticated = computed(() => !!this._token())
	readonly accessToken     = this._token.asReadonly()
	readonly currentUser     = this._user.asReadonly()

	setTokens(tokens: AuthTokens): void {
		sessionStorage.setItem(ACCESS_KEY, tokens.access_token)
		sessionStorage.setItem(REFRESH_KEY, tokens.refresh_token)
		if (tokens.user) sessionStorage.setItem(USER_KEY, JSON.stringify(tokens.user))
		this._token.set(tokens.access_token)
		this._user.set(tokens.user ?? decodeUserFromJwt(tokens.access_token))
		const ctx = (window as any).__SHELL_CONTEXT__
		if (ctx) ctx.accessToken = tokens.access_token
	}

	clearTokens(): void {
		sessionStorage.removeItem(ACCESS_KEY)
		sessionStorage.removeItem(REFRESH_KEY)
		sessionStorage.removeItem(USER_KEY)
		this._token.set(null)
		this._user.set(null)
	}

	getRefreshToken(): string | null {
		return sessionStorage.getItem(REFRESH_KEY)
	}

	// Returns the service UUIDs from the JWT payload.
	// An empty array means no restriction (superadmin / token pre-dates services claim).
	getServices(): string[] {
		const token = this._token()
		if (!token) return []
		try {
			const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
			const payload = JSON.parse(atob(b64))
			return Array.isArray(payload.services) ? payload.services : []
		} catch {
			return []
		}
	}

	// Silently refreshes the access token. Uses fetch (not HttpClient) to avoid
	// triggering the auth interceptor and creating a circular retry loop.
	async silentRefresh(): Promise<boolean> {
		const refreshToken = this.getRefreshToken()
		if (!refreshToken) return false

		const authApiUrl = (window as any).__SHELL_CONTEXT__?.authApiUrl ?? 'http://localhost:8081'

		try {
			const res = await fetch(`${authApiUrl}/auth/refresh`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ refresh_token: refreshToken }),
			})
			if (!res.ok) return false
			const json = await res.json()
			this.setTokens(json.data ?? json)
			return true
		} catch {
			return false
		}
	}
}
