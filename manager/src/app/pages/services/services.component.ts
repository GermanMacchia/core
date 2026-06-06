import { Component, inject, signal, OnInit } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { AdminService } from '../../core/services/admin.service'
import { Service } from '../../core/models/tenant.model'

@Component({
	selector: 'app-services',
	standalone: true,
	imports: [FormsModule],
	template: `
		<div class="p-6 lg:p-10 max-w-6xl">
			<div class="flex items-center justify-between mb-6">
				<div>
					<h1 class="text-2xl font-bold text-base-content">Catálogo de servicios</h1>
					<p class="text-base-content/50 text-sm">{{ services().length }} servicios</p>
				</div>
				<button class="btn btn-primary btn-sm" onclick="modal_create_svc.showModal()">
					+ Nuevo servicio
				</button>
			</div>

			@if (error()) {
				<div class="alert alert-error mb-4 text-sm">{{ error() }}</div>
			}

			<div class="card bg-base-100 shadow-sm border border-base-300">
				<div class="overflow-x-auto">
					<table class="table table-sm">
						<thead>
							<tr class="text-xs text-base-content/50 uppercase">
								<th>Nombre</th>
								<th>Slug</th>
								<th>Versión</th>
								<th>MFE URL</th>
								<th>API URL</th>
								<th class="text-center">Activo</th>
							</tr>
						</thead>
						<tbody>
							@if (loading()) {
								<tr>
									<td colspan="6" class="text-center py-8">
										<span class="loading loading-spinner loading-sm"></span>
									</td>
								</tr>
							} @else if (services().length === 0) {
								<tr>
									<td colspan="6" class="text-center py-8 text-base-content/40 text-sm">
										Sin servicios en el catálogo
									</td>
								</tr>
							} @else {
								@for (s of services(); track s.id) {
									<tr class="hover">
										<td>
											<div class="font-medium text-sm">{{ s.name }}</div>
											@if (s.description) {
												<div class="text-xs text-base-content/40">{{ s.description }}</div>
											}
										</td>
										<td class="font-mono text-xs">{{ s.slug }}</td>
										<td class="text-xs">{{ s.version }}</td>
										<td class="text-xs text-base-content/60 max-w-[200px] truncate">
											{{ s.mfe_url }}
										</td>
										<td class="text-xs text-base-content/60 max-w-[160px] truncate">
											{{ s.api_url ?? '—' }}
										</td>
										<td class="text-center">
											@if (s.is_active) {
												<span class="badge badge-sm badge-success">Sí</span>
											} @else {
												<span class="badge badge-sm badge-ghost">No</span>
											}
										</td>
									</tr>
								}
							}
						</tbody>
					</table>
				</div>
			</div>
		</div>

		<!-- Create Service Modal -->
		<dialog id="modal_create_svc" class="modal">
			<div class="modal-box w-full max-w-md">
				<h3 class="font-bold text-lg mb-4">Nuevo servicio</h3>

				@if (createError()) {
					<div class="alert alert-error mb-3 text-sm py-2">{{ createError() }}</div>
				}

				<div class="flex flex-col gap-3">
					<label class="form-control">
						<span class="label label-text text-xs">Nombre *</span>
						<input
							type="text"
							class="input input-bordered input-sm"
							[(ngModel)]="form.name"
							placeholder="Mi Servicio" />
					</label>
					<label class="form-control">
						<span class="label label-text text-xs"
							>Slug * <span class="text-base-content/40">(único)</span></span
						>
						<input
							type="text"
							class="input input-bordered input-sm"
							[(ngModel)]="form.slug"
							placeholder="mi-servicio" />
					</label>
					<label class="form-control">
						<span class="label label-text text-xs">Versión *</span>
						<input
							type="text"
							class="input input-bordered input-sm"
							[(ngModel)]="form.version"
							placeholder="1.0.0" />
					</label>
					<label class="form-control">
						<span class="label label-text text-xs">MFE URL *</span>
						<input
							type="text"
							class="input input-bordered input-sm"
							[(ngModel)]="form.mfe_url"
							placeholder="http://localhost:4200/remoteEntry.js" />
					</label>
					<label class="form-control">
						<span class="label label-text text-xs">API URL</span>
						<input
							type="text"
							class="input input-bordered input-sm"
							[(ngModel)]="form.api_url"
							placeholder="http://localhost:3000" />
					</label>
					<label class="form-control">
						<span class="label label-text text-xs">Descripción</span>
						<input
							type="text"
							class="input input-bordered input-sm"
							[(ngModel)]="form.description" />
					</label>
				</div>

				<div class="modal-action">
					<form method="dialog">
						<button class="btn btn-ghost btn-sm" (click)="resetForm()">Cancelar</button>
					</form>
					<button class="btn btn-primary btn-sm" [disabled]="creating()" (click)="create()">
						@if (creating()) {
							<span class="loading loading-spinner loading-xs"></span>
						}
						Crear
					</button>
				</div>
			</div>
			<form method="dialog" class="modal-backdrop"><button>close</button></form>
		</dialog>
	`,
})
export class ServicesComponent implements OnInit {
	private admin = inject(AdminService)

	services = signal<Service[]>([])
	loading = signal(true)
	error = signal<string | null>(null)
	creating = signal(false)
	createError = signal<string | null>(null)

	form = { name: '', slug: '', version: '', mfe_url: '', api_url: '', description: '' }

	ngOnInit() {
		this.load()
	}

	load() {
		this.loading.set(true)
		this.admin.listServices().subscribe({
			next: res => {
				this.services.set(res.data ?? [])
				this.loading.set(false)
			},
			error: () => {
				this.error.set('Error al cargar los servicios.')
				this.loading.set(false)
			},
		})
	}

	create() {
		if (!this.form.name || !this.form.slug || !this.form.version || !this.form.mfe_url) {
			this.createError.set('Nombre, slug, versión y MFE URL son requeridos.')
			return
		}
		this.creating.set(true)
		this.createError.set(null)

		const body: {
			name: string
			slug: string
			version: string
			mfe_url: string
			api_url?: string
			description?: string
		} = {
			name: this.form.name,
			slug: this.form.slug,
			version: this.form.version,
			mfe_url: this.form.mfe_url,
		}
		if (this.form.api_url) body.api_url = this.form.api_url
		if (this.form.description) body.description = this.form.description

		this.admin.createService(body).subscribe({
			next: res => {
				this.services.update(list => [res.data, ...list])
				this.creating.set(false)
				this.resetForm()
				;(document.getElementById('modal_create_svc') as HTMLDialogElement).close()
			},
			error: err => {
				this.createError.set(err.error?.error ?? 'Error al crear el servicio.')
				this.creating.set(false)
			},
		})
	}

	resetForm() {
		this.form = { name: '', slug: '', version: '', mfe_url: '', api_url: '', description: '' }
		this.createError.set(null)
	}
}
