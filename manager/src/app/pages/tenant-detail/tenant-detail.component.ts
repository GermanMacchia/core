import { Component, computed, inject, Input, OnInit, signal } from '@angular/core'
import { FormBuilder, Validators } from '@angular/forms'
import { RouterLink } from '@angular/router'
import type {
	CompactListAction,
	CompactListColumn,
	FormField,
	InfoCardData,
} from '@germanmacchia/angular-ui'
import {
	CompactList,
	CompactListCellDirective,
	Form,
	InfoCard,
	InfoModalService,
	ToastService,
} from '@germanmacchia/angular-ui'
import { Service, Tenant, TenantUser } from '../../core/models/tenant.model'
import { AdminService } from '../../core/services/admin.service'

type Tab = 'overview' | 'services' | 'users'

const STATUS_BADGE: Record<string, string> = {
	active: 'badge-success',
	trial: 'badge-warning',
	suspended: 'badge-error',
	cancelled: 'badge-ghost',
}

@Component({
	selector: 'app-tenant-detail',
	standalone: true,
	imports: [RouterLink, CompactList, CompactListCellDirective, Form, InfoCard],
	template: `
		<div class="p-6 lg:p-10">
			<div class="mb-2">
				<a routerLink="/tenants" class="text-xs text-base-content/40 hover:text-base-content">
					<i class="bi bi-arrow-left"></i> Tenants
				</a>
			</div>

			@if (loadingTenant()) {
				<div class="flex justify-center py-16">
					<span class="loading loading-spinner loading-md"></span>
				</div>
			} @else if (!tenant()) {
				<div class="alert alert-error mt-4">No se encontró el tenant.</div>
			} @else {
				<!-- Header -->
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
							<i [class]="tab.icon + ' mr-1.5'"></i>{{ tab.label }}
						</a>
					}
				</div>

				<!-- Overview Tab -->
				@if (activeTab() === 'overview') {
					<div class="flex flex-col gap-4 max-w-xl">
						<lib-info-card [data]="cardData()" />
						<div class="flex justify-end">
							<button class="btn btn-primary btn-sm" (click)="showEdit.set(true)">
								<i class="bi bi-pencil"></i> Editar
							</button>
						</div>
					</div>
				}

				<!-- Services Tab -->
				@if (activeTab() === 'services') {
					<lib-compact-list
						[items]="serviceRows()"
						[columns]="serviceColumns"
						[loading]="loadingServices()"
						[emptyIcon]="'bi bi-grid'"
						[emptyMessage]="'No hay servicios en el catálogo'"
						[trackByKey]="'service.id'">
						<ng-template compactListCell="is_enabled" let-item>
							<input
								type="checkbox"
								class="toggle toggle-success toggle-sm"
								[checked]="item.enabled"
								[disabled]="item.busy"
								(change)="toggleService(item)" />
						</ng-template>
					</lib-compact-list>
				}

				<!-- Users Tab -->
				@if (activeTab() === 'users') {
					<div class="flex flex-col gap-4">
						<div class="flex justify-end">
							<button class="btn btn-primary btn-sm" (click)="showCreateUser.set(true)">
								<i class="bi bi-person-plus"></i> Nuevo usuario
							</button>
						</div>
						<lib-compact-list
							[items]="users()"
							[columns]="userColumns"
							[actions]="userActions"
							[loading]="loadingUsers()"
							[emptyIcon]="'bi bi-people'"
							[emptyMessage]="'Sin usuarios'"
							[trackByKey]="'id'"
							[booleanTrueLabel]="'Activo'"
							[booleanFalseLabel]="'Inactivo'"
							(actionClick)="onUserAction($event)">
							<ng-template compactListCell="last_login_at" let-item>
								<span class="text-xs text-base-content/60">
									{{ item.last_login_at ? fmtDate(item.last_login_at) : 'Nunca' }}
								</span>
							</ng-template>
						</lib-compact-list>
					</div>
				}
			}
		</div>

		<!-- Edit Tenant Modal -->
		<lib-form
			[formGroup]="editForm"
			[fields]="editFields"
			[displayMode]="'modal'"
			[title]="'Editar tenant'"
			[isOpen]="showEdit()"
			(submitEvent)="onUpdate()"
			(cancelEvent)="showEdit.set(false)" />

		<!-- Create User Modal -->
		<lib-form
			[formGroup]="userForm"
			[fields]="userFields"
			[displayMode]="'modal'"
			[title]="'Nuevo usuario'"
			[isOpen]="showCreateUser()"
			(submitEvent)="onCreateUser()"
			(cancelEvent)="showCreateUser.set(false)" />

		<!-- Edit User Modal -->
		<lib-form
			[formGroup]="editUserForm"
			[fields]="editUserFields"
			[displayMode]="'modal'"
			[title]="'Editar usuario'"
			[isOpen]="showEditUser()"
			(submitEvent)="onUpdateUser()"
			(cancelEvent)="showEditUser.set(false)" />
	`,
})
export class TenantDetailComponent implements OnInit {
	@Input() id!: string

	private admin = inject(AdminService)
	private fb = inject(FormBuilder)
	private toast = inject(ToastService)
	private infoModal = inject(InfoModalService)

	activeTab = signal<Tab>('overview')
	tabs = [
		{ id: 'overview' as Tab, label: 'General', icon: 'bi bi-info-circle' },
		{ id: 'services' as Tab, label: 'Servicios', icon: 'bi bi-grid' },
		{ id: 'users' as Tab, label: 'Usuarios', icon: 'bi bi-people' },
	]

	// Overview
	tenant = signal<Tenant | null>(null)
	loadingTenant = signal(true)
	showEdit = signal(false)

	editForm = this.fb.group({
		name: [''],
		domain: [''],
		status: ['active'],
	})

	editFields: FormField[] = [
		{ name: 'name', label: 'Nombre', type: 'text', placeholder: 'Nombre del tenant' },
		{ name: 'domain', label: 'Dominio', type: 'text', placeholder: 'acme.example.com' },
		{
			name: 'status',
			label: 'Estado',
			type: 'select',
			options: [
				{ label: 'Activo', value: 'active' },
				{ label: 'Trial', value: 'trial' },
				{ label: 'Suspendido', value: 'suspended' },
				{ label: 'Cancelado', value: 'cancelled' },
			],
		},
	]

	cardData = computed<InfoCardData>(() => {
		const t = this.tenant()
		if (!t) return { title: '', sections: [] }
		return {
			title: t.name,
			titleIcon: 'bi bi-building',
			layout: 'grid',
			gridCols: 2,
			sections: [
				{ name: 'Slug', content: t.slug, icon: 'bi bi-tag' },
				{
					name: 'Estado',
					content: t.status,
					type: 'badge',
					contentClass: this.statusBadge(t.status),
					icon: 'bi bi-circle',
				},
				{ name: 'Dominio', content: t.domain ?? '—', icon: 'bi bi-globe' },
				{ name: 'Plan', content: t.plan?.name ?? '—', icon: 'bi bi-credit-card' },
				{ name: 'Creado', content: this.fmtDate(t.created_at), icon: 'bi bi-calendar' },
				{ name: 'Actualizado', content: this.fmtDate(t.updated_at), icon: 'bi bi-clock' },
			],
		}
	})

	// Services
	serviceRows = signal<{ service: Service; enabled: boolean; busy: boolean }[]>([])
	loadingServices = signal(false)

	serviceColumns: CompactListColumn<{ service: Service; enabled: boolean; busy: boolean }>[] = [
		{ key: 'name', header: 'Servicio', type: 'text', transform: r => r.service.name },
		{ key: 'slug', header: 'Slug', type: 'text', transform: r => r.service.slug },
		{ key: 'version', header: 'Versión', type: 'text', transform: r => r.service.version },
		{ key: 'mfe_url', header: 'MFE URL', type: 'text', transform: r => r.service.mfe_url },
		{ key: 'is_enabled', header: 'Habilitado', type: 'custom' },
	]

	// Users
	users = signal<TenantUser[]>([])
	loadingUsers = signal(false)
	showCreateUser = signal(false)
	showEditUser = signal(false)
	private editUserTarget: TenantUser | null = null

	userForm = this.fb.group({
		email: ['', [Validators.required, Validators.email]],
		password: ['', Validators.required],
		role: ['member'],
	})

	editUserForm = this.fb.group({
		role: ['member'],
		is_active: [true],
	})

	userFields: FormField[] = [
		{ name: 'email', label: 'Email', type: 'email', required: true },
		{ name: 'password', label: 'Contraseña', type: 'password', required: true },
		{
			name: 'role',
			label: 'Rol',
			type: 'select',
			options: [
				{ label: 'Admin', value: 'admin' },
				{ label: 'Member', value: 'member' },
				{ label: 'Viewer', value: 'viewer' },
			],
		},
	]

	editUserFields: FormField[] = [
		{
			name: 'role',
			label: 'Rol',
			type: 'select',
			options: [
				{ label: 'Admin', value: 'admin' },
				{ label: 'Member', value: 'member' },
				{ label: 'Viewer', value: 'viewer' },
			],
		},
		{
			name: 'is_active',
			label: 'Estado',
			type: 'select',
			options: [
				{ label: 'Activo', value: true },
				{ label: 'Inactivo', value: false },
			],
		},
	]

	userColumns: CompactListColumn<TenantUser>[] = [
		{ key: 'email', header: 'Email', type: 'text' },
		{ key: 'role', header: 'Rol', type: 'badge' },
		{ key: 'is_active', header: 'Activo', type: 'boolean' },
		{ key: 'last_login_at', header: 'Último acceso', type: 'custom' },
	]

	userActions: CompactListAction<TenantUser>[] = [
		{ id: 'edit', icon: 'bi bi-pencil', tooltip: 'Editar' },
		{ id: 'delete', icon: 'bi bi-trash', tooltip: 'Eliminar', class: 'text-error' },
	]

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
				this.editForm.patchValue({
					name: res.data.name,
					domain: res.data.domain ?? '',
					status: res.data.status,
				})
				this.loadingTenant.set(false)
			},
			error: () => this.loadingTenant.set(false),
		})
	}

	loadServices() {
		this.loadingServices.set(true)
		this.admin.listServices(false).subscribe({
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

	onUpdate() {
		const v = this.editForm.getRawValue()
		const body: { name?: string; domain?: string; status?: string } = {}
		if (v.name) body.name = v.name
		if (v.domain) body.domain = v.domain
		if (v.status) body.status = v.status

		this.admin.updateTenant(this.id, body).subscribe({
			next: res => {
				this.tenant.set(res.data)
				this.showEdit.set(false)
				this.toast.toast({ severity: 'success', body: 'Tenant actualizado correctamente.' })
			},
			error: err => {
				this.toast.toast({ severity: 'error', body: err.error?.error ?? 'Error al actualizar.' })
			},
		})
	}

	toggleService(row: { service: Service; enabled: boolean; busy: boolean }) {
		row.busy = true
		this.serviceRows.update(r => [...r])

		if (row.enabled) {
			this.admin.disableService(this.id, row.service.id).subscribe({
				next: () => {
					row.enabled = false
					row.busy = false
					this.serviceRows.update(r => [...r])
					this.toast.toast({ severity: 'success', body: `"${row.service.name}" deshabilitado.` })
				},
				error: () => {
					row.busy = false
					this.serviceRows.update(r => [...r])
					this.toast.toast({ severity: 'error', body: 'Error al deshabilitar el servicio.' })
				},
			})
		} else {
			this.admin.enableService(this.id, row.service.id).subscribe({
				next: () => {
					row.enabled = true
					row.busy = false
					this.serviceRows.update(r => [...r])
					this.toast.toast({ severity: 'success', body: `"${row.service.name}" habilitado.` })
				},
				error: () => {
					row.busy = false
					this.serviceRows.update(r => [...r])
					this.toast.toast({ severity: 'error', body: 'Error al habilitar el servicio.' })
				},
			})
		}
	}

	onCreateUser() {
		if (this.userForm.invalid) {
			this.toast.toast({ severity: 'warning', body: 'Email y contraseña son requeridos.' })
			return
		}
		const v = this.userForm.getRawValue()
		this.admin
			.createTenantUser(this.id, {
				email: v.email!,
				password: v.password!,
				role: v.role ?? 'member',
			})
			.subscribe({
				next: res => {
					this.users.update(list => [...list, res.data])
					this.showCreateUser.set(false)
					this.userForm.reset({ role: 'member' })
					this.toast.toast({ severity: 'success', body: `Usuario "${res.data.email}" creado.` })
				},
				error: err => {
					this.toast.toast({
						severity: 'error',
						body: err.error?.error ?? 'Error al crear el usuario.',
					})
				},
			})
	}

	onUserAction(event: { action: string; item: TenantUser }) {
		if (event.action === 'edit') {
			this.editUserTarget = event.item
			this.editUserForm.patchValue({
				role: event.item.role,
				is_active: event.item.is_active,
			})
			this.showEditUser.set(true)
		} else if (event.action === 'delete') {
			this.infoModal.openAsConfirm(
				() => this.doDeleteUser(event.item),
				`¿Eliminar al usuario "${event.item.email}"?`,
			)
		}
	}

	onUpdateUser() {
		if (!this.editUserTarget) return
		const v = this.editUserForm.getRawValue()
		this.admin
			.updateTenantUser(this.id, this.editUserTarget.id, {
				role: v.role ?? undefined,
				is_active: v.is_active ?? undefined,
			})
			.subscribe({
				next: res => {
					this.users.update(list => list.map(u => (u.id === res.data.id ? res.data : u)))
					this.showEditUser.set(false)
					this.editUserTarget = null
					this.toast.toast({
						severity: 'success',
						body: `Usuario "${res.data.email}" actualizado.`,
					})
				},
				error: err => {
					this.toast.toast({
						severity: 'error',
						body: err.error?.error ?? 'Error al actualizar el usuario.',
					})
				},
			})
	}

	private doDeleteUser(user: TenantUser) {
		this.admin.deleteTenantUser(this.id, user.id).subscribe({
			next: () => {
				this.users.update(list => list.filter(u => u.id !== user.id))
				this.toast.toast({ severity: 'success', body: `Usuario "${user.email}" eliminado.` })
			},
			error: () => {
				this.toast.toast({ severity: 'error', body: 'Error al eliminar el usuario.' })
			},
		})
	}

	statusBadge(status: string) {
		return STATUS_BADGE[status] ?? 'badge-ghost'
	}

	fmtDate(iso: string) {
		return new Date(iso).toLocaleDateString('es-AR', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
		})
	}
}
