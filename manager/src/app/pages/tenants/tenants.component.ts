import { Component, inject, signal, OnInit } from '@angular/core'
import { RouterLink } from '@angular/router'
import { FormsModule } from '@angular/forms'
import { AdminService } from '../../core/services/admin.service'
import { Tenant } from '../../core/models/tenant.model'

const STATUS_BADGE: Record<string, string> = {
	active: 'badge-success',
	trial: 'badge-warning',
	suspended: 'badge-error',
	cancelled: 'badge-ghost',
}

@Component({
	selector: 'app-tenants',
	standalone: true,
	imports: [RouterLink, FormsModule],
	template: `
		<div class="p-6 lg:p-10 max-w-6xl">
			<div class="flex items-center justify-between mb-6">
				<div>
					<h1 class="text-2xl font-bold text-base-content">Tenants</h1>
					<p class="text-base-content/50 text-sm">{{ total() }} registrados</p>
				</div>
				<button class="btn btn-primary btn-sm" onclick="modal_create.showModal()">
					+ Nuevo tenant
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
								<th>Dominio</th>
								<th>Plan</th>
								<th>Estado</th>
								<th>Creado</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							@if (loading()) {
								<tr>
									<td colspan="7" class="text-center py-8">
										<span class="loading loading-spinner loading-sm"></span>
									</td>
								</tr>
							} @else if (tenants().length === 0) {
								<tr>
									<td colspan="7" class="text-center py-8 text-base-content/40 text-sm">
										Sin tenants registrados
									</td>
								</tr>
							} @else {
								@for (t of tenants(); track t.id) {
									<tr class="hover">
										<td class="font-medium">{{ t.name }}</td>
										<td class="font-mono text-xs">{{ t.slug }}</td>
										<td class="text-xs text-base-content/60">{{ t.domain ?? '—' }}</td>
										<td class="text-xs">{{ t.plan?.name ?? '—' }}</td>
										<td>
											<span class="badge badge-sm" [class]="statusBadge(t.status)">
												{{ t.status }}
											</span>
										</td>
										<td class="text-xs text-base-content/50">{{ formatDate(t.created_at) }}</td>
										<td class="text-right">
											<div class="flex gap-1 justify-end">
												<a [routerLink]="['/tenants', t.id]" class="btn btn-ghost btn-xs">Ver</a>
												<button class="btn btn-ghost btn-xs text-error" (click)="confirmDelete(t)">
													Eliminar
												</button>
											</div>
										</td>
									</tr>
								}
							}
						</tbody>
					</table>
				</div>
			</div>

			@if (total() > pageSize) {
				<div class="flex gap-2 mt-4 justify-end">
					<button class="btn btn-sm btn-ghost" [disabled]="offset() === 0" (click)="prevPage()">
						‹ Anterior
					</button>
					<button
						class="btn btn-sm btn-ghost"
						[disabled]="offset() + pageSize >= total()"
						(click)="nextPage()">
						Siguiente ›
					</button>
				</div>
			}
		</div>

		<!-- Create Modal -->
		<dialog id="modal_create" class="modal">
			<div class="modal-box w-full max-w-md">
				<h3 class="font-bold text-lg mb-4">Nuevo tenant</h3>

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
							placeholder="Acme Corp" />
					</label>
					<label class="form-control">
						<span class="label label-text text-xs"
							>Slug * <span class="text-base-content/40">(único, sin espacios)</span></span
						>
						<input
							type="text"
							class="input input-bordered input-sm"
							[(ngModel)]="form.slug"
							placeholder="acme" />
					</label>
					<label class="form-control">
						<span class="label label-text text-xs">Dominio</span>
						<input
							type="text"
							class="input input-bordered input-sm"
							[(ngModel)]="form.domain"
							placeholder="acme.example.com" />
					</label>
					<label class="form-control">
						<span class="label label-text text-xs">Plan ID *</span>
						<input
							type="text"
							class="input input-bordered input-sm font-mono text-xs"
							[(ngModel)]="form.plan_id"
							placeholder="UUID del plan" />
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

		<!-- Delete Confirm Modal -->
		<dialog id="modal_delete" class="modal">
			<div class="modal-box max-w-sm">
				<h3 class="font-bold text-lg">Confirmar eliminación</h3>
				<p class="py-4 text-sm text-base-content/70">
					¿Eliminar el tenant <strong>{{ deleteTarget()?.name }}</strong
					>? El estado cambiará a <em>cancelled</em>.
				</p>
				<div class="modal-action">
					<form method="dialog">
						<button class="btn btn-ghost btn-sm">Cancelar</button>
					</form>
					<button class="btn btn-error btn-sm" [disabled]="deleting()" (click)="deleteTenant()">
						@if (deleting()) {
							<span class="loading loading-spinner loading-xs"></span>
						}
						Eliminar
					</button>
				</div>
			</div>
			<form method="dialog" class="modal-backdrop"><button>close</button></form>
		</dialog>
	`,
})
export class TenantsComponent implements OnInit {
	private admin = inject(AdminService)

	tenants = signal<Tenant[]>([])
	total = signal(0)
	loading = signal(true)
	error = signal<string | null>(null)
	creating = signal(false)
	createError = signal<string | null>(null)
	deleting = signal(false)
	deleteTarget = signal<Tenant | null>(null)
	offset = signal(0)
	readonly pageSize = 20

	form = { name: '', slug: '', domain: '', plan_id: '' }

	ngOnInit() {
		this.load()
	}

	load() {
		this.loading.set(true)
		this.error.set(null)
		this.admin.listTenants(this.pageSize, this.offset()).subscribe({
			next: res => {
				this.tenants.set(res.data ?? [])
				this.total.set(res.meta?.total ?? res.data?.length ?? 0)
				this.loading.set(false)
			},
			error: () => {
				this.error.set('Error al cargar los tenants.')
				this.loading.set(false)
			},
		})
	}

	create() {
		if (!this.form.name || !this.form.slug || !this.form.plan_id) {
			this.createError.set('Nombre, slug y plan son requeridos.')
			return
		}
		this.creating.set(true)
		this.createError.set(null)

		const body: { slug: string; name: string; plan_id: string; domain?: string } = {
			slug: this.form.slug,
			name: this.form.name,
			plan_id: this.form.plan_id,
		}
		if (this.form.domain) body.domain = this.form.domain

		this.admin.createTenant(body).subscribe({
			next: res => {
				this.tenants.update(list => [res.data, ...list])
				this.total.update(n => n + 1)
				this.creating.set(false)
				this.resetForm()
				;(document.getElementById('modal_create') as HTMLDialogElement).close()
			},
			error: err => {
				this.createError.set(err.error?.error ?? 'Error al crear el tenant.')
				this.creating.set(false)
			},
		})
	}

	confirmDelete(t: Tenant) {
		this.deleteTarget.set(t)
		;(document.getElementById('modal_delete') as HTMLDialogElement).showModal()
	}

	deleteTenant() {
		const t = this.deleteTarget()
		if (!t) return
		this.deleting.set(true)
		this.admin.deleteTenant(t.id).subscribe({
			next: () => {
				this.tenants.update(list => list.filter(x => x.id !== t.id))
				this.total.update(n => n - 1)
				this.deleting.set(false)
				this.deleteTarget.set(null)
				;(document.getElementById('modal_delete') as HTMLDialogElement).close()
			},
			error: () => {
				this.deleting.set(false)
			},
		})
	}

	resetForm() {
		this.form = { name: '', slug: '', domain: '', plan_id: '' }
		this.createError.set(null)
	}

	prevPage() {
		this.offset.update(n => Math.max(0, n - this.pageSize))
		this.load()
	}
	nextPage() {
		this.offset.update(n => n + this.pageSize)
		this.load()
	}

	statusBadge(status: string) {
		return STATUS_BADGE[status] ?? 'badge-ghost'
	}

	formatDate(iso: string) {
		return new Date(iso).toLocaleDateString('es-AR', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
		})
	}
}
