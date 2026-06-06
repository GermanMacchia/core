import { Component, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { Router } from '@angular/router'
import { AuthService } from '../../core/services/auth.service'
import { ApiResponse, AuthTokens } from '../../core/models/tenant.model'

@Component({
	selector: 'app-login-page',
	standalone: true,
	imports: [FormsModule],
	template: `
		<div class="min-h-screen bg-base-200 flex items-center justify-center p-4">
			<div class="card bg-base-100 shadow-xl w-full max-w-sm">
				<div class="card-body gap-5">
					<div class="text-center">
						<h1 class="text-2xl font-bold text-base-content tracking-tight">Platform Manager</h1>
						<p class="text-base-content/40 text-sm mt-1">Panel de administración</p>
					</div>

					@if (error()) {
						<div class="alert alert-error text-sm py-2">{{ error() }}</div>
					}

					<div class="flex flex-col gap-3">
						<label class="form-control">
							<span class="label label-text text-xs font-medium">Email</span>
							<input
								type="email"
								class="input input-bordered input-sm"
								[(ngModel)]="email"
								placeholder="admin@ejemplo.com"
								(keyup.enter)="submit()" />
						</label>
						<label class="form-control">
							<span class="label label-text text-xs font-medium">Contraseña</span>
							<input
								type="password"
								class="input input-bordered input-sm"
								[(ngModel)]="password"
								placeholder="••••••••"
								(keyup.enter)="submit()" />
						</label>

						<button
							class="btn btn-primary btn-sm mt-1"
							[disabled]="loading() || !email || !password"
							(click)="submit()">
							@if (loading()) {
								<span class="loading loading-spinner loading-xs"></span>
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
	private auth = inject(AuthService)
	private http = inject(HttpClient)
	private router = inject(Router)

	email = ''
	password = ''
	loading = signal(false)
	error = signal<string | null>(null)

	constructor() {
		if (this.auth.isAuthenticated()) this.router.navigate(['/'])
	}

	submit() {
		if (!this.email || !this.password) return

		this.loading.set(true)
		this.error.set(null)

		this.http
			.post<ApiResponse<AuthTokens>>('http://localhost:8080/api/v1/auth/login', {
				email: this.email,
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
