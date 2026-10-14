import { Component, inject, signal } from '@angular/core'
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms'
import { Router } from '@angular/router'
import { AuthService } from '../../core/services/auth.service'
import { apiErrorMessage } from '../../core/utils/api-error'

@Component({
	selector: 'app-login-page',
	standalone: true,
	imports: [ReactiveFormsModule],
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

					<form [formGroup]="form" class="mgr-flex mgr-flex-col mgr-gap-3" (ngSubmit)="submit()">
						<label class="mgr-form-control">
							<span class="mgr-label mgr-label-text mgr-text-xs mgr-font-medium">Email</span>
							<input
								type="email"
								class="mgr-input mgr-input-bordered mgr-input-sm"
								formControlName="email"
								placeholder="admin@ejemplo.com" />
						</label>
						<label class="mgr-form-control">
							<span class="mgr-label mgr-label-text mgr-text-xs mgr-font-medium">Contraseña</span>
							<input
								type="password"
								class="mgr-input mgr-input-bordered mgr-input-sm"
								formControlName="password"
								placeholder="••••••••" />
						</label>

						<button
							type="submit"
							class="mgr-btn mgr-btn-primary mgr-btn-sm mgr-mt-1"
							[disabled]="loading()">
							@if (loading()) {
								<span class="mgr-loading mgr-loading-spinner mgr-loading-xs"></span>
							}
							Iniciar sesión
						</button>
					</form>
				</div>
			</div>
		</div>
	`,
})
export class LoginPageComponent {
	private auth   = inject(AuthService)
	private router = inject(Router)
	private fb     = inject(FormBuilder)

	loading = signal(false)
	error   = signal<string | null>(null)

	form = this.fb.nonNullable.group({
		email:    ['', [Validators.required, Validators.email]],
		password: ['', Validators.required],
	})

	constructor() {
		if (this.auth.isAuthenticated()) this.router.navigate(['/'])
	}

	submit() {
		if (this.loading()) return
		if (this.form.invalid) {
			this.error.set('Ingrese un email válido y la contraseña.')
			return
		}

		const { email, password } = this.form.getRawValue()
		this.loading.set(true)
		this.error.set(null)

		this.auth.login(email, password).subscribe({
			next: () => this.router.navigate(['/']),
			error: (err: unknown) => {
				this.error.set(apiErrorMessage(err, 'Credenciales inválidas.'))
				this.loading.set(false)
			},
		})
	}
}
