import { Component, inject, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core'
import { TenantService } from '../../core/services/tenant.service'

@Component({
	selector: 'app-dashboard',
	standalone: true,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `
		<div class="p-6 lg:p-10">
			<h1 class="text-2xl font-bold text-base-content mb-1">Dashboard</h1>
			<p class="text-base-content/50 text-sm mb-8">
				Servicios habilitados para <strong>{{ tenant.config().tenant.name }}</strong>
			</p>

			@if (tenant.config().mfes.length === 0) {
				<div class="card bg-base-200 shadow-sm max-w-md">
					<div class="card-body items-center text-center gap-3">
						<div class="text-4xl">🧩</div>
						<h2 class="card-title text-base">Sin servicios configurados</h2>
						<p class="text-sm text-base-content/50">
							Cuando el Core tenga servicios habilitados para este tenant, aparecerán aquí como
							micro-frontends cargados dinámicamente.
						</p>
					</div>
				</div>
			} @else {
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
					@for (mfe of tenant.config().mfes; track mfe.slug) {
						<div class="card bg-base-200 shadow-sm">
							<div class="card-body">
								<h2 class="card-title text-sm capitalize">{{ mfe.slug }}</h2>
								<div class="badge badge-sm" [class]="mfe.public ? 'badge-success' : 'badge-ghost'">
									{{ mfe.public ? 'Público' : 'Privado' }}
								</div>
							</div>
						</div>
					}
				</div>
			}
		</div>
	`,
})
export class DashboardComponent {
	protected tenant = inject(TenantService)
}
