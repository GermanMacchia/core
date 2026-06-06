import { HttpClient, HttpHeaders } from '@angular/common/http'
import { Injectable, inject, signal } from '@angular/core'
import { TenantConfig } from '../models/tenant.model'

const CORE_API = 'http://localhost:8080'

const FALLBACK: TenantConfig = {
	tenant: { slug: 'local', name: 'Platform', primary_color: '#6366f1' },
	auth_mfe_url: 'http://localhost:4174/login-mfe.iife.js',
	mfes: [],
}

@Injectable({ providedIn: 'root' })
export class TenantService {
	private http = inject(HttpClient)

	readonly config = signal<TenantConfig>(FALLBACK)

	loadConfig(): Promise<void> {
		const slug = this.slugFromHostname()
		const headers = slug ? new HttpHeaders({ 'X-Tenant-Slug': slug }) : undefined

		return new Promise(resolve => {
			this.http
				.get<{ data: TenantConfig }>(`${CORE_API}/api/v1/public/config`, { headers })
				.subscribe({
					next: res => {
						this.config.set(res.data)
						resolve()
					},
					error: () => resolve(),
				})
		})
	}

	// Slug del tenant: build-time env var tiene prioridad (un deploy por tenant),
	// con fallback a subdominio en runtime.
	private slugFromHostname(): string {
		const envSlug = (import.meta as any).env?.VITE_TENANT_SLUG
		if (envSlug) return envSlug

		const parts = window.location.hostname.split('.')
		const candidate = parts[0]
		if (parts.length > 1 && candidate !== 'www' && candidate !== 'api') {
			return candidate
		}
		return ''
	}
}
