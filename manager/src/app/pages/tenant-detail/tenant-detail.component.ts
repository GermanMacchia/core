import { Component, inject, signal, OnInit, Input } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { RouterLink } from '@angular/router'
import { AdminService } from '../../core/services/admin.service'
import { Tenant, Service, TenantServiceEntry, TenantUser } from '../../core/models/tenant.model'

type Tab = 'overview' | 'services' | 'users'

const STATUS_OPTS = ['active', 'suspended', 'trial', 'cancelled'] as const
const ROLE_OPTS = ['admin', 'member', 'viewer'] as const

const STATUS_BADGE: Record<string, string> = {
	active: 'badge-success',
	trial: 'badge-warning',
	suspended: 'badge-error',
	cancelled: 'badge-ghost',
}

@Component({
	selector: 'app-tenant-detail',
	standalone: true,
	imports: [FormsModule, RouterLink],
	template: `
		<div class="p-6 lg:p-10 max-w-5xl">
			<div class="mb-1">
				<a routerLink="/tenants" class="text-xs text-base-content/40 hover:text-base-content"
					>← Tenants</a
				>
			</div>

			@if (loadingTenant()) {
				<div class="flex justify-center py-16">
					<span class="loading loading-spinner loading-md"></span>
				</div>
			} @else if (!tenant()) {
				<div class="alert alert-error mt-4">No se encontró el tenant.</div>
			} @else {
				<div class="flex items-start justify-between mb-6 gap-4 flex-wrap">
					<div>
						<h1 class="text-2xl font-bold text-base-content">{{ tenant()!.name }}</h1>
						<div class="flex gap-2 items-center mt-1">
							<code class="text-xs bg-base-200 px-2 py-0.5 rounded">{{ tenant()!.slug }}</code>
							<span class="badge badge-sm" [class]="statusBadge(tenant()!.status)">{{
								tenant()!.status
							}}</span>
							@if (tenant()!.plan) {
								<span class="text-xs text-base-content/50">{{ tenant()!.plan!.name }}</span>
							}
						</div>
					</div>
				</div>

				<!-- Tabs -->
				<div role="tablist" class="tabs tabs-border mb-6">
					@for (tab of tabs; track tab.id) {
						<a
							role="tab"
							class="tab"
							[class.tab-active]="activeTab() === tab.id"
							(click)="activeTab.set(tab.id)">
							{{ tab.label }}
						</a>
					}
				</div>

				<!-- Overview Tab -->
				@if (activeTab() === 'overview') {
					<div class="card bg-base-100 border border-base-300 shadow-sm max-w-lg">
						<div class="card-body gap-4">
							<h2 class="card-title text-base">Información general</h2>

							@if (saveError()) {
								<div class="alert alert-error text-sm py-2">{{ saveError() }}</div>
							}
							@if (saveOk()) {
								<div class="alert alert-success text-sm py-2">Guardado correctamente.</div>
							}

							<label class="form-control">
								<span class="label label-text text-xs">Nombre</span>
								<input type="text" class="input input-bordered input-sm" [(ngModel)]="edit.name" />
							</label>
							<label class="form-control">
								<span class="label label-text text-xs">Dominio</span>
								<input
									type="text"
									class="input input-bordered input-sm"
									[(ngModel)]="edit.domain"
									placeholder="acme.example.com" />
							</label>
							<label class="form-control">
								<span class="label label-text text-xs">Estado</span>
								<select class="select select-bordered select-sm" [(ngModel)]="edit.status">
									@for (s of statusOpts; track s) {
										<option [value]="s">{{ s }}</option>
									}
								</select>
							</label>

							<div class="card-actions justify-end">
								<button class="btn btn-primary btn-sm" [disabled]="saving()" (click)="save()">
									@if (saving()) {
										<span class="loading loading-spinner loading-xs"></span>
									}
									Guardar
								</button>
							</div>
						</div>
					</div>
				}

				<!-- Services Tab -->
				@if (activeTab() === 'services') {
					<div class="card bg-base-100 border border-base-300 shadow-sm">
						<div class="card-body">
							<h2 class="card-title text-base mb-2">Servicios del catálogo</h2>
							@if (loadingServices()) {
								<span class="loading loading-spinner loading-sm"></span>
							} @else {
								<div class="overflow-x-auto">
									<table class="table table-sm">
										<thead>
											<tr class="text-xs text-base-content/50 uppercase">
												<th>Servicio</th>
												<th>Versión</th>
												<th>MFE URL</th>
												<th class="text-center">Habilitado</th>
											</tr>
										</thead>
										<tbody>
											@for (row of serviceRows(); track row.service.id) {
												<tr class="hover">
													<td>
														<div class="font-medium text-sm">{{ row.service.name }}</div>
														<div class="text-xs text-base-content/40 font-mono">
															{{ row.service.slug }}
														</div>
													</td>
													<td class="text-xs">{{ row.service.version }}</td>
													<td class="text-xs text-base-content/50 max-w-xs truncate">
														{{ row.service.mfe_url }}
													</td>
													<td class="text-center">
														<input
															type="checkbox"
															class="toggle toggle-success toggle-sm"
															[checked]="row.enabled"
															[disabled]="row.busy"
															(change)="toggleService(row)" />
													</td>
												</tr>
											}
										</tbody>
									</table>
								</div>
							}
						</div>
					</div>
				}

				<!-- Users Tab -->
				@if (activeTab() === 'users') {
					<div class="flex flex-col gap-4">
						<div class="card bg-base-100 border border-base-300 shadow-sm">
							<div class="card-body">
								<div class="flex items-center justify-between mb-2">
									<h2 class="card-title text-base">Usuarios</h2>
									<button class="btn btn-sm btn-primary" onclick="modal_new_user.showModal()">
										+ Usuario
									</button>
								</div>
								@if (loadingUsers()) {
									<span class="loading loading-spinner loading-sm"></span>
								} @else {
									<div class="overflow-x-auto">
										<table class="table table-sm">
											<thead>
												<tr class="text-xs text-base-content/50 uppercase">
													<th>Email</th>
													<th>Rol</th>
													<th>Activo</th>
													<th>Último acceso</th>
												</tr>
											</thead>
											<tbody>
												@if (users().length === 0) {
													<tr>
														<td colspan="4" class="text-center py-6 text-base-content/40 text-sm">
															Sin usuarios
														</td>
													</tr>
												}
												@for (u of users(); track u.id) {
													<tr class="hover">
														<td class="text-sm">{{ u.email }}</td>
														<td>
															<span class="badge badge-sm badge-ghost">{{ u.role }}</span>
														</td>
														<td>
															@if (u.is_active) {
																<span class="badge badge-sm badge-success">Sí</span>
															} @else {
																<span class="badge badge-sm badge-error">No</span>
															}
														</td>
														<td class="text-xs text-base-content/50">
															{{ u.last_login_at ? formatDate(u.last_login_at) : 'Nunca' }}
														</td>
													</tr>
												}
											</tbody>
										</table>
									</div>
								}
							</div>
						</div>
					</div>

					<!-- New user modal -->
					<dialog id="modal_new_user" class="modal">
						<div class="modal-box max-w-sm">
							<h3 class="font-bold text-lg mb-4">Nuevo usuario</h3>

							@if (userError()) {
								<div class="alert alert-error mb-3 text-sm py-2">{{ userError() }}</div>
							}

							<div class="flex flex-col gap-3">
								<label class="form-control">
									<span class="label label-text text-xs">Email *</span>
									<input
										type="email"
										class="input input-bordered input-sm"
										[(ngModel)]="userForm.email" />
								</label>
								<label class="form-control">
									<span class="label label-text text-xs">Contraseña *</span>
									<input
										type="password"
										class="input input-bordered input-sm"
										[(ngModel)]="userForm.password" />
								</label>
								<label class="form-control">
									<span class="label label-text text-xs">Rol</span>
									<select class="select select-bordered select-sm" [(ngModel)]="userForm.role">
										@for (r of roleOpts; track r) {
											<option [value]="r">{{ r }}</option>
										}
									</select>
								</label>
							</div>

							<div class="modal-action">
								<form method="dialog">
									<button class="btn btn-ghost btn-sm" (click)="resetUserForm()">Cancelar</button>
								</form>
								<button
									class="btn btn-primary btn-sm"
									[disabled]="creatingUser()"
									(click)="createUser()">
									@if (creatingUser()) {
										<span class="loading loading-spinner loading-xs"></span>
									}
									Crear
								</button>
							</div>
						</div>
						<form method="dialog" class="modal-backdrop"><button>close</button></form>
					</dialog>
				}
			}
		</div>
	`,
})
export class TenantDetailComponent implements OnInit {
	@Input() id!: string

	private admin = inject(AdminService)

	activeTab = signal<Tab>('overview')
	tabs = [
		{ id: 'overview' as Tab, label: 'General' },
		{ id: 'services' as Tab, label: 'Servicios' },
		{ id: 'users' as Tab, label: 'Usuarios' },
	]

	tenant = signal<Tenant | null>(null)
	loadingTenant = signal(true)
	saving = signal(false)
	saveError = signal<string | null>(null)
	saveOk = signal(false)

	edit = { name: '', domain: '', status: '' }
	statusOpts = STATUS_OPTS
	roleOpts = ROLE_OPTS

	serviceRows = signal<{ service: Service; enabled: boolean; busy: boolean }[]>([])
	loadingServices = signal(false)

	users = signal<TenantUser[]>([])
	loadingUsers = signal(false)
	creatingUser = signal(false)
	userError = signal<string | null>(null)
	userForm = { email: '', password: '', role: 'member' }

	ngOnInit() {
		this.loadTenant()
		this.loadServices()
		this.loadUsers()
	}

	loadTenant() {
		this.loadingTenant.set(true)
		this.admin.getTenant(this.id).subscribe({
			next: res => {
				this.tenant.set(res.data)
				this.edit = {
					name: res.data.name,
					domain: res.data.domain ?? '',
					status: res.data.status,
				}
				this.loadingTenant.set(false)
			},
			error: () => this.loadingTenant.set(false),
		})
	}

	loadServices() {
		this.loadingServices.set(true)
		this.admin.listServices().subscribe({
			next: catalogRes => {
				const all = catalogRes.data ?? []
				this.admin.getTenantServices(this.id).subscribe({
					next: tsRes => {
						const enabledIds = new Set((tsRes.data ?? []).map(e => e.service_id))
						this.serviceRows.set(
							all.map(s => ({ service: s, enabled: enabledIds.has(s.id), busy: false })),
						)
						this.loadingServices.set(false)
					},
					error: () => this.loadingServices.set(false),
				})
			},
			error: () => this.loadingServices.set(false),
		})
	}

	loadUsers() {
		this.loadingUsers.set(true)
		this.admin.getTenantUsers(this.id).subscribe({
			next: res => {
				this.users.set(res.data ?? [])
				this.loadingUsers.set(false)
			},
			error: () => this.loadingUsers.set(false),
		})
	}

	save() {
		this.saving.set(true)
		this.saveError.set(null)
		this.saveOk.set(false)

		const body: { name?: string; domain?: string; status?: string } = {
			name: this.edit.name || undefined,
			status: this.edit.status || undefined,
		}
		if (this.edit.domain) body.domain = this.edit.domain

		this.admin.updateTenant(this.id, body).subscribe({
			next: res => {
				this.tenant.set(res.data)
				this.saving.set(false)
				this.saveOk.set(true)
				setTimeout(() => this.saveOk.set(false), 3000)
			},
			error: err => {
				this.saveError.set(err.error?.error ?? 'Error al guardar.')
				this.saving.set(false)
			},
		})
	}

	toggleService(row: { service: Service; enabled: boolean; busy: boolean }) {
		row.busy = true
		if (row.enabled) {
			this.admin.disableService(this.id, row.service.id).subscribe({
				next: () => {
					row.enabled = false
					row.busy = false
					this.serviceRows.update(r => [...r])
				},
				error: () => {
					row.busy = false
					this.serviceRows.update(r => [...r])
				},
			})
		} else {
			this.admin.enableService(this.id, row.service.id).subscribe({
				next: () => {
					row.enabled = true
					row.busy = false
					this.serviceRows.update(r => [...r])
				},
				error: () => {
					row.busy = false
					this.serviceRows.update(r => [...r])
				},
			})
		}
	}

	createUser() {
		if (!this.userForm.email || !this.userForm.password) {
			this.userError.set('Email y contraseña son requeridos.')
			return
		}
		this.creatingUser.set(true)
		this.userError.set(null)

		this.admin.createTenantUser(this.id, this.userForm).subscribe({
			next: res => {
				this.users.update(list => [...list, res.data])
				this.creatingUser.set(false)
				this.resetUserForm()
				;(document.getElementById('modal_new_user') as HTMLDialogElement).close()
			},
			error: err => {
				this.userError.set(err.error?.error ?? 'Error al crear el usuario.')
				this.creatingUser.set(false)
			},
		})
	}

	resetUserForm() {
		this.userForm = { email: '', password: '', role: 'member' }
		this.userError.set(null)
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
