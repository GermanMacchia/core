import { Injectable, signal, computed } from '@angular/core'
import { AuthTokens, AuthUser } from '../models/tenant.model'

const ACCESS_KEY = 'platform_access_token'
const REFRESH_KEY = 'platform_refresh_token'
const USER_KEY = 'platform_user'

@Injectable({ providedIn: 'root' })
export class AuthService {
	private readonly _token = signal<string | null>(sessionStorage.getItem(ACCESS_KEY))
	private readonly _user = signal<AuthUser | null>(
		JSON.parse(sessionStorage.getItem(USER_KEY) ?? 'null'),
	)

	readonly isAuthenticated = computed(() => !!this._token())
	readonly accessToken = this._token.asReadonly()
	readonly currentUser = this._user.asReadonly()

	setTokens(tokens: AuthTokens): void {
		sessionStorage.setItem(ACCESS_KEY, tokens.access_token)
		sessionStorage.setItem(REFRESH_KEY, tokens.refresh_token)
		sessionStorage.setItem(USER_KEY, JSON.stringify(tokens.user))
		this._token.set(tokens.access_token)
		this._user.set(tokens.user)
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
}
