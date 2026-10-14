import { Injectable, computed, inject, signal } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { type Observable, map, tap } from 'rxjs'
import type { ApiResponse, AuthTokens, AuthUser } from '../models/tenant.model'
import { authApiUrl } from '../config/api.config'

// Keys are shared with the shell so a single session covers all MFEs.
const ACCESS_KEY  = 'shell_access_token'
const REFRESH_KEY = 'shell_refresh_token'
const USER_KEY    = 'shell_user'

interface JwtPayload {
	sub?: string
	email?: string
	role?: string
	tenant_id?: string
	services?: unknown
}

function decodeJwtPayload(token: string | null): JwtPayload | null {
	if (!token) return null
	try {
		const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
		const payload: unknown = JSON.parse(atob(b64))
		return typeof payload === 'object' && payload !== null ? (payload as JwtPayload) : null
	} catch {
		// A malformed token is treated the same as no token.
		return null
	}
}

function decodeUserFromJwt(token: string | null): AuthUser | null {
	const p = decodeJwtPayload(token)
	if (!p) return null
	return { id: p.sub ?? '', email: p.email ?? '', role: p.role ?? '', tenant_id: p.tenant_id ?? '' }
}

function storedUser(): AuthUser | null {
	try {
		const parsed: unknown = JSON.parse(sessionStorage.getItem(USER_KEY) ?? 'null')
		return typeof parsed === 'object' && parsed !== null ? (parsed as AuthUser) : null
	} catch {
		// Corrupted storage: fall back to the user encoded in the token.
		return null
	}
}

@Injectable({ providedIn: 'root' })
export class AuthService {
	private http = inject(HttpClient)

	private readonly _token = signal<string | null>(sessionStorage.getItem(ACCESS_KEY))
	private readonly _user  = signal<AuthUser | null>(
		storedUser() ?? decodeUserFromJwt(sessionStorage.getItem(ACCESS_KEY)),
	)

	readonly isAuthenticated = computed(() => !!this._token())
	readonly accessToken     = this._token.asReadonly()
	readonly currentUser     = this._user.asReadonly()

	login(email: string, password: string): Observable<AuthTokens> {
		return this.http
			.post<ApiResponse<AuthTokens>>(`${authApiUrl()}/auth/login`, { email, password })
			.pipe(
				map(res => res.data),
				tap(tokens => this.setTokens(tokens)),
			)
	}

	setTokens(tokens: AuthTokens): void {
		sessionStorage.setItem(ACCESS_KEY, tokens.access_token)
		sessionStorage.setItem(REFRESH_KEY, tokens.refresh_token)
		if (tokens.user) sessionStorage.setItem(USER_KEY, JSON.stringify(tokens.user))
		this._token.set(tokens.access_token)
		this._user.set(tokens.user ?? decodeUserFromJwt(tokens.access_token))
		const ctx = window.__SHELL_CONTEXT__
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
		const services = decodeJwtPayload(this._token())?.services
		return Array.isArray(services) ? services.filter((s): s is string => typeof s === 'string') : []
	}

	// Silently refreshes the access token. Uses fetch (not HttpClient) to avoid
	// triggering the auth interceptor and creating a circular retry loop.
	async silentRefresh(): Promise<boolean> {
		const refreshToken = this.getRefreshToken()
		if (!refreshToken) return false

		try {
			const res = await fetch(`${authApiUrl()}/auth/refresh`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ refresh_token: refreshToken }),
			})
			if (!res.ok) return false
			const json: { data?: AuthTokens } & Partial<AuthTokens> = await res.json()
			this.setTokens(json.data ?? (json as AuthTokens))
			return true
		} catch {
			// Network failure: the caller treats it as an expired session and
			// sends the user to the login page.
			return false
		}
	}
}
