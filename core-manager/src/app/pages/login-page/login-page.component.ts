import { Component, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { Router } from '@angular/router'
import { AuthService } from '../../core/services/auth.service'
import { TenantService } from '../../core/services/tenant.service'
import { ApiResponse, AuthTokens } from '../../core/models/tenant.model'

@Component({
	selector: 'app-login-page',
	standalone: true,
	imports: [FormsModule],
	template: `
		<div class="mgr-min-h-screen mgr-bg-base-200 mgr-flex mgr-items-center mgr-justify-center mgr-p-4">
			<div class="mgr-card mgr-bg-base-100 mgr-shadow-xl mgr-w-full mgr-max-w-sm">
				<div class="mgr-card-body mgr-gap-5">
					<div class="mgr-text-center">
						<h1 class="mgr-text-2xl mgr-font-bold mgr-text-base-content mgr-tracking-tight">Platform Manager</h1>
						<p class="mgr-text-base-content/40 mgr-text-sm mgr-mt-1">Panel de administración</p>
					</div>

					@if (error()) {
						<div class="mgr-alert mgr-alert-error mgr-text-sm mgr-py-2">{{ error() }}</div>
					}

					<div class="mgr-flex mgr-flex-col mgr-gap-3">
						<label class="mgr-form-control">
							<span class="mgr-label mgr-label-text mgr-text-xs mgr-font-medium">Email</span>
							<input
								type="email"
								class="mgr-input mgr-input-bordered mgr-input-sm"
								[(ngModel)]="email"
								placeholder="admin@ejemplo.com"
								(keyup.enter)="submit()" />
						</label>
						<label class="mgr-form-control">
							<span class="mgr-label mgr-label-text mgr-text-xs mgr-font-medium">Contraseña</span>
							<input
								type="password"
								class="mgr-input mgr-input-bordered mgr-input-sm"
								[(ngModel)]="password"
								placeholder="••••••••"
								(keyup.enter)="submit()" />
						</label>

						<button
							class="mgr-btn mgr-btn-primary mgr-btn-sm mgr-mt-1"
							[disabled]="loading() || !email || !password"
							(click)="submit()">
							@if (loading()) {
								<span class="mgr-loading mgr-loading-spinner mgr-loading-xs"></span>
							}
							Iniciar sesión
						</button>
					</div>
				</div>
			</div>
		</div>
	`,
})
export class LoginPageComponent {
	private auth   = inject(AuthService)
	private http   = inject(HttpClient)
	private router = inject(Router)
	private tenant = inject(TenantService)

	email    = ''
	password = ''
	loading  = signal(false)
	error    = signal<string | null>(null)

	constructor() {
		if (this.auth.isAuthenticated()) this.router.navigate(['/'])
	}

	private get authApiUrl(): string {
		// Shell context has priority (set by main.single-spa.ts from customProps).
		return (window as any).__SHELL_CONTEXT__?.authApiUrl
			?? this.tenant.config().auth_api_url
			?? 'http://localhost:8081'
	}

	submit() {
		if (!this.email || !this.password) return

		// Basic email format guard before hitting the network.
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
			this.error.set('Ingrese un email válido.')
			return
		}

		this.loading.set(true)
		this.error.set(null)

		this.http
			.post<ApiResponse<AuthTokens>>(`${this.authApiUrl}/auth/login`, {
				email:    this.email,
				password: this.password,
			})
			.subscribe({
				next: res => {
					this.auth.setTokens(res.data)
					this.router.navigate(['/'])
				},
				error: err => {
					this.error.set(err.error?.error ?? 'Credenciales inválidas.')
					this.loading.set(false)
				},
			})
	}
}
