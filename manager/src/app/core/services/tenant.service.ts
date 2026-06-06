import { Injectable, inject, signal } from '@angular/core'
import { HttpClient } from '@angular/common/http'
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
		return new Promise(resolve => {
			this.http.get<{ data: TenantConfig }>(`${CORE_API}/api/v1/public/config`).subscribe({
				next: res => {
					this.config.set(res.data)
					resolve()
				},
				error: () => resolve(),
			})
		})
	}
}
