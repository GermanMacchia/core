import { Component, inject, signal, type OnInit } from '@angular/core'
import type { HttpErrorResponse } from '@angular/common/http'
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms'
import {
	CompactList,
	CompactListCellDirective,
	ToastService,
	InfoModalService,
} from '@germanmacchia/angular-ui'
import type { CompactListColumn, CompactListAction } from '@germanmacchia/angular-ui'
import { AdminService } from '../../core/services/admin.service'
import type { ConfigDefinition, Deployment, RoleOption, Service } from '../../core/models/tenant.model'
import { apiErrorMessage } from '../../core/utils/api-error'
import { ConfigEditorComponent } from '../../shared/config-editor.component'
import { buildConfigFromValues, defaultConfigValues, existingConfigToValues } from '../../shared/config-fields'

@Component({
	selector: 'app-services',
	standalone: true,
	imports: [CompactList, CompactListCellDirective, ReactiveFormsModule, ConfigEditorComponent],
	template: `
		<div class="p-6 lg:p-10 max-w-6xl">
			<div class="flex items-center justify-between mb-6">
				<div>
					<h1 class="text-2xl font-bold text-base-content">Catálogo de servicios</h1>
					<p class="text-base-content/50 text-sm">{{ services().length }} servicios registrados</p>
				</div>
				<button class="btn btn-primary btn-sm" (click)="showCreate.set(true)">
					<i class="bi bi-plus-lg"></i> Nuevo servicio
				</button>
			</div>

			<lib-compact-list
				[items]="services()"
				[columns]="columns"
				[actions]="actions"
				[loading]="loading()"
				[emptyIcon]="'bi bi-grid'"
				[emptyMessage]="'Sin servicios en el catálogo'"
				[pageSize]="20"
				[trackByKey]="'id'"
				[booleanTrueLabel]="'Activo'"
				[booleanFalseLabel]="'Inactivo'"
				(actionClick)="onAction($event)">
				<ng-template compactListCell="id" let-item>
					<button
						class="text-xs text-base-content/60 hover:text-base-content flex items-center gap-1 cursor-pointer"
						title="Copiar ID"
						(click)="copyId(item.id)">
						{{ item.id }}
						<i class="bi bi-clipboard"></i>
					</button>
				</ng-template>
			</lib-compact-list>
		</div>

		<!-- Create Modal -->
		<dialog class="modal" [class.modal-open]="showCreate()">
			<div class="modal-box w-11/12 max-w-lg flex flex-col p-0 max-h-[90vh]">
				<div class="px-6 py-4 border-b border-base-200">
					<h3 class="font-semibold text-lg">Nuevo servicio</h3>
				</div>
				<form [formGroup]="createForm" class="flex flex-col overflow-hidden">
					<div class="px-6 py-5 flex-1 overflow-y-auto">
						<div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
							<label class="form-control">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Nombre <span class="text-error text-xs">*</span></span></div>
								<input formControlName="name" type="text" class="input input-bordered" placeholder="Mi Servicio">
							</label>
							<label class="form-control">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Deploy <span class="text-error text-xs">*</span></span></div>
								<select formControlName="deployment_id" class="select select-bordered">
									<option value="" disabled>Seleccioná un deploy</option>
									@for (d of deployments(); track d.id) {
										<option [value]="d.id">{{ d.name }} ({{ d.version }})</option>
									}
								</select>
							</label>
							<label class="form-control md:col-span-2">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Descripción</span></div>
								<textarea formControlName="description" class="textarea textarea-bordered textarea-sm resize-none" rows="2"></textarea>
							</label>
							<label class="label cursor-pointer justify-start gap-2 md:col-span-2">
								<input formControlName="requires_business" type="checkbox" class="checkbox checkbox-sm">
								<span class="label-text text-sm font-medium">Requiere negocio</span>
							</label>
						</div>
						<app-config-editor
							[defs]="configDefs()"
							[value]="createConfigValues()"
							(valueChange)="createConfigValues.set($event)" />
					</div>
					<div class="px-6 py-4 border-t border-base-200 flex justify-end gap-2">
						<button type="button" class="btn btn-ghost btn-sm" (click)="showCreate.set(false)">Cancelar</button>
						<button type="button" class="btn btn-primary btn-sm" [disabled]="saving()" (click)="onCreate()">
							@if (saving()) { <span class="loading loading-spinner loading-xs"></span> }
							Crear
						</button>
					</div>
				</form>
			</div>
			<form method="dialog" class="modal-backdrop" (click)="showCreate.set(false)"><button>close</button></form>
		</dialog>

		<!-- Edit Modal -->
		<dialog class="modal" [class.modal-open]="showEdit()">
			<div class="modal-box w-11/12 max-w-lg flex flex-col p-0 max-h-[90vh]">
				<div class="px-6 py-4 border-b border-base-200">
					<h3 class="font-semibold text-lg">Editar servicio</h3>
				</div>
				<form [formGroup]="editForm" class="flex flex-col overflow-hidden">
					<div class="px-6 py-5 flex-1 overflow-y-auto">
						<div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
							<label class="form-control">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Nombre</span></div>
								<input formControlName="name" type="text" class="input input-bordered" placeholder="Mi Servicio">
							</label>
							<label class="form-control">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Deploy</span></div>
								<select formControlName="deployment_id" class="select select-bordered">
									@for (d of deployments(); track d.id) {
										<option [value]="d.id">{{ d.name }} ({{ d.version }})</option>
									}
								</select>
							</label>
							<label class="form-control md:col-span-2">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Descripción</span></div>
								<textarea formControlName="description" class="textarea textarea-bordered textarea-sm resize-none" rows="2"></textarea>
							</label>
							<label class="form-control md:col-span-2">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Estado</span></div>
								<select formControlName="is_active" class="select select-bordered select-sm">
									<option [ngValue]="true">Activo</option>
									<option [ngValue]="false">Inactivo</option>
								</select>
							</label>
							<label class="label cursor-pointer justify-start gap-2 md:col-span-2">
								<input formControlName="requires_business" type="checkbox" class="checkbox checkbox-sm">
								<span class="label-text text-sm font-medium">Requiere negocio</span>
							</label>
						</div>
						<app-config-editor
							[defs]="configDefs()"
							[value]="editConfigValues()"
							(valueChange)="editConfigValues.set($event)" />
					</div>
					<div class="px-6 py-4 border-t border-base-200 flex justify-end gap-2">
						<button type="button" class="btn btn-ghost btn-sm" (click)="showEdit.set(false)">Cancelar</button>
						<button type="button" class="btn btn-primary btn-sm" [disabled]="saving()" (click)="onUpdate()">
							@if (saving()) { <span class="loading loading-spinner loading-xs"></span> }
							Guardar
						</button>
					</div>
				</form>
			</div>
			<form method="dialog" class="modal-backdrop" (click)="showEdit.set(false)"><button>close</button></form>
		</dialog>

		<!-- Roles Modal -->
		<dialog class="modal" [class.modal-open]="showRoles()">
			<div class="modal-box w-11/12 max-w-2xl flex flex-col p-0 max-h-[90vh]">
				<div class="px-6 py-4 border-b border-base-200 flex items-center justify-between">
					<h3 class="font-semibold text-lg">Roles de "{{ rolesTarget()?.name }}"</h3>
					<button type="button" class="btn btn-ghost btn-sm btn-circle" (click)="closeRoles()">
						<i class="bi bi-x-lg"></i>
					</button>
				</div>
				<div class="px-6 py-5 flex-1 overflow-y-auto">
					<lib-compact-list
						[items]="roles()"
						[columns]="roleColumns"
						[actions]="roleActions"
						[loading]="rolesLoading()"
						[emptyIcon]="'bi bi-person-badge'"
						[emptyMessage]="'Sin roles para este servicio'"
						[pageSize]="10"
						[trackByKey]="'id'"
						(actionClick)="onRoleAction($event)">
					</lib-compact-list>

					<form [formGroup]="roleForm" class="mt-5 pt-5 border-t border-base-200">
						<h4 class="text-sm font-medium mb-3">{{ editingRole() ? 'Editar rol' : 'Nuevo rol' }}</h4>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
							<label class="form-control">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Nombre <span class="text-error text-xs">*</span></span></div>
								<input formControlName="name" type="text" class="input input-bordered input-sm" placeholder="Admin">
							</label>
							<label class="form-control">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Descripción</span></div>
								<input formControlName="description" type="text" class="input input-bordered input-sm" placeholder="Opcional">
							</label>
						</div>
						<div class="flex justify-end gap-2 mt-4">
							@if (editingRole()) {
								<button type="button" class="btn btn-ghost btn-sm" (click)="cancelRoleEdit()">Cancelar</button>
							}
							<button type="button" class="btn btn-primary btn-sm" [disabled]="saving()" (click)="onSaveRole()">
								@if (saving()) { <span class="loading loading-spinner loading-xs"></span> }
								{{ editingRole() ? 'Guardar' : 'Crear' }}
							</button>
						</div>
					</form>
				</div>
				<div class="px-6 py-4 border-t border-base-200 flex justify-end gap-2">
					<button type="button" class="btn btn-ghost btn-sm" (click)="closeRoles()">Cerrar</button>
				</div>
			</div>
			<form method="dialog" class="modal-backdrop" (click)="closeRoles()"><button>close</button></form>
		</dialog>
	`,
})
export class ServicesComponent implements OnInit {
	private admin = inject(AdminService)
	private fb = inject(FormBuilder)
	private toast = inject(ToastService)
	private infoModal = inject(InfoModalService)

	services = signal<Service[]>([])
	deployments = signal<Deployment[]>([])
	loading = signal(true)
	saving = signal(false)
	showCreate = signal(false)
	showEdit = signal(false)
	private editTarget: Service | null = null

	showRoles = signal(false)
	rolesTarget = signal<Service | null>(null)
	roles = signal<RoleOption[]>([])
	rolesLoading = signal(false)
	editingRole = signal<RoleOption | null>(null)

	configDefs = signal<ConfigDefinition[]>([])
	createConfigValues = signal<Record<string, string>>({})
	editConfigValues = signal<Record<string, string>>({})

	createForm = this.fb.nonNullable.group({
		name: ['', Validators.required],
		deployment_id: ['', Validators.required],
		description: [''],
		requires_business: [true],
	})

	editForm = this.fb.nonNullable.group({
		name: [''],
		deployment_id: [''],
		description: [''],
		is_active: [true],
		requires_business: [true],
	})

	roleForm = this.fb.nonNullable.group({
		name: ['', Validators.required],
		description: [''],
	})

	columns: CompactListColumn<Service>[] = [
		{ key: 'id', header: 'ID', type: 'custom' },
		{ key: 'name', prop: 'name', header: 'Nombre', type: 'text' },
		{ key: 'deployment', header: 'Deploy', type: 'text', transform: s => s.deployment_name ?? s.mfe_url },
		{ key: 'version', prop: 'version', header: 'Versión', type: 'text' },
		{ key: 'description', header: 'Descripción', type: 'text', transform: s => s.description ?? '—' },
		{ key: 'is_active', prop: 'is_active', header: 'Activo', type: 'boolean' },
		{ key: 'requires_business', prop: 'requires_business', header: 'Requiere negocio', type: 'boolean' },
	]

	actions: CompactListAction<Service>[] = [
		{ id: 'roles', icon: 'bi bi-person-badge', tooltip: 'Roles' },
		{ id: 'edit', icon: 'bi bi-pencil', tooltip: 'Editar' },
		{ id: 'delete', icon: 'bi bi-trash', tooltip: 'Eliminar', class: 'text-error' },
	]

	roleColumns: CompactListColumn<RoleOption>[] = [
		{ key: 'name', prop: 'name', header: 'Nombre', type: 'text' },
		{ key: 'description', header: 'Descripción', type: 'text', transform: r => r.description ?? '—' },
	]

	roleActions: CompactListAction<RoleOption>[] = [
		{ id: 'edit', icon: 'bi bi-pencil', tooltip: 'Editar' },
		{ id: 'delete', icon: 'bi bi-trash', tooltip: 'Eliminar', class: 'text-error' },
	]

	ngOnInit() {
		this.load()
		this.loadConfigDefs()
		this.loadDeployments()
	}

	loadDeployments() {
		this.admin.listDeployments().subscribe({
			next: res => this.deployments.set(res.data ?? []),
			error: (err: HttpErrorResponse) => {
				this.toast.toast({ severity: 'error', body: apiErrorMessage(err, 'Error al cargar los deploys.') })
			},
		})
	}

	copyId(id: string) {
		navigator.clipboard.writeText(id).then(
			() => this.toast.toast({ severity: 'info', body: 'ID copiado al portapapeles.' }),
			() => this.toast.toast({ severity: 'error', body: 'No se pudo copiar el ID.' }),
		)
	}

	load() {
		this.loading.set(true)
		this.admin.listServices().subscribe({
			next: res => {
				this.services.set(res.data ?? [])
				this.loading.set(false)
			},
			error: (err: HttpErrorResponse) => {
				this.toast.toast({ severity: 'error', body: apiErrorMessage(err, 'Error al cargar los servicios.') })
				this.loading.set(false)
			},
		})
	}

	loadConfigDefs() {
		this.admin.listConfigDefinitions().subscribe({
			next: res => {
				const defs = (res.data ?? []).filter(d => d.scope === 'service')
				this.configDefs.set(defs)
				this.createConfigValues.set(defaultConfigValues(defs))
			},
			error: (err: HttpErrorResponse) => {
				this.toast.toast({ severity: 'error', body: apiErrorMessage(err, 'Error al cargar las definiciones de configuración.') })
			},
		})
	}

	onAction(event: { action: string; item: Service }) {
		if (event.action === 'roles') {
			this.openRoles(event.item)
		} else if (event.action === 'edit') {
			this.editTarget = event.item
			this.editForm.patchValue({
				name: event.item.name,
				deployment_id: event.item.deployment_id,
				description: event.item.description ?? '',
				is_active: event.item.is_active,
				requires_business: event.item.requires_business,
			})
			this.editConfigValues.set(existingConfigToValues(event.item.config ?? {}, this.configDefs()))
			this.showEdit.set(true)
		} else if (event.action === 'delete') {
			this.infoModal.openAsConfirm(
				() => this.doDelete(event.item),
				`¿Eliminar el servicio "${event.item.name}"?`,
			)
		}
	}

	onCreate() {
		if (this.createForm.invalid) {
			this.toast.toast({ severity: 'warning', body: 'Completá los campos requeridos.' })
			return
		}
		if (this.saving()) return
		const v = this.createForm.getRawValue()
		this.saving.set(true)
		this.admin.createService({
			name: v.name,
			deployment_id: v.deployment_id,
			...(v.description ? { description: v.description } : {}),
			config: buildConfigFromValues(this.createConfigValues(), this.configDefs()),
			requires_business: v.requires_business,
		}).subscribe({
			next: res => {
				this.saving.set(false)
				this.services.update(list => [res.data, ...list])
				this.showCreate.set(false)
				this.createForm.reset()
				this.createConfigValues.set(defaultConfigValues(this.configDefs()))
				this.toast.toast({ severity: 'success', body: `Servicio "${res.data.name}" creado.` })
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false)
				this.toast.toast({ severity: 'error', body: apiErrorMessage(err, 'Error al crear el servicio.') })
			},
		})
	}

	onUpdate() {
		if (!this.editTarget || this.saving()) return
		const v = this.editForm.getRawValue()
		const body: Parameters<AdminService['updateService']>[1] = {
			description: v.description,
			is_active: v.is_active,
			requires_business: v.requires_business,
			config: buildConfigFromValues(this.editConfigValues(), this.configDefs()),
		}
		if (v.name) body.name = v.name
		if (v.deployment_id) body.deployment_id = v.deployment_id

		this.saving.set(true)
		this.admin.updateService(this.editTarget.id, body).subscribe({
			next: res => {
				this.saving.set(false)
				this.services.update(list => list.map(s => s.id === res.data.id ? res.data : s))
				this.showEdit.set(false)
				this.editTarget = null
				this.toast.toast({ severity: 'success', body: `Servicio "${res.data.name}" actualizado.` })
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false)
				this.toast.toast({ severity: 'error', body: apiErrorMessage(err, 'Error al actualizar el servicio.') })
			},
		})
	}

	private doDelete(svc: Service) {
		if (this.saving()) return
		this.saving.set(true)
		this.admin.deleteService(svc.id).subscribe({
			next: () => {
				this.saving.set(false)
				this.services.update(list => list.filter(s => s.id !== svc.id))
				this.toast.toast({ severity: 'success', body: `Servicio "${svc.name}" eliminado.` })
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false)
				this.toast.toast({ severity: 'error', body: apiErrorMessage(err, 'Error al eliminar el servicio.') })
			},
		})
	}

	openRoles(svc: Service) {
		this.rolesTarget.set(svc)
		this.editingRole.set(null)
		this.roleForm.reset()
		this.showRoles.set(true)
		this.loadRoles()
	}

	closeRoles() {
		this.showRoles.set(false)
		this.rolesTarget.set(null)
		this.roles.set([])
		this.editingRole.set(null)
		this.roleForm.reset()
	}

	loadRoles() {
		const target = this.rolesTarget()
		if (!target) return
		this.rolesLoading.set(true)
		this.admin.listRolesByService(target.id).subscribe({
			next: res => {
				this.roles.set(res.data ?? [])
				this.rolesLoading.set(false)
			},
			error: (err: HttpErrorResponse) => {
				this.toast.toast({ severity: 'error', body: apiErrorMessage(err, 'Error al cargar los roles.') })
				this.rolesLoading.set(false)
			},
		})
	}

	onRoleAction(event: { action: string; item: RoleOption }) {
		if (event.action === 'edit') {
			this.editingRole.set(event.item)
			this.roleForm.setValue({
				name: event.item.name,
				description: event.item.description ?? '',
			})
		} else if (event.action === 'delete') {
			this.infoModal.openAsConfirm(
				() => this.doDeleteRole(event.item),
				`¿Eliminar el rol "${event.item.name}"?`,
			)
		}
	}

	cancelRoleEdit() {
		this.editingRole.set(null)
		this.roleForm.reset()
	}

	onSaveRole() {
		if (this.roleForm.invalid) {
			this.toast.toast({ severity: 'warning', body: 'El nombre del rol es obligatorio.' })
			return
		}
		if (this.saving()) return
		const v = this.roleForm.getRawValue()
		const editing = this.editingRole()

		if (editing) {
			this.saving.set(true)
			this.admin.updateRole(editing.id, {
				name: v.name || undefined,
				description: v.description ? v.description : undefined,
			}).subscribe({
				next: res => {
					this.saving.set(false)
					this.roles.update(list => list.map(r => (r.id === res.data.id ? res.data : r)))
					this.cancelRoleEdit()
					this.toast.toast({ severity: 'success', body: `Rol "${res.data.name}" actualizado.` })
				},
				error: (err: HttpErrorResponse) => {
					this.saving.set(false)
					this.toast.toast({ severity: 'error', body: apiErrorMessage(err, 'Error al actualizar el rol.') })
				},
			})
			return
		}

		const target = this.rolesTarget()
		if (!target) return
		this.saving.set(true)
		this.admin.createRole(target.id, {
			name: v.name,
			...(v.description ? { description: v.description } : {}),
		}).subscribe({
			next: res => {
				this.saving.set(false)
				this.roles.update(list => [...list, res.data])
				this.roleForm.reset()
				this.toast.toast({ severity: 'success', body: `Rol "${res.data.name}" creado.` })
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false)
				this.toast.toast({ severity: 'error', body: apiErrorMessage(err, 'Error al crear el rol.') })
			},
		})
	}

	private doDeleteRole(role: RoleOption) {
		if (this.saving()) return
		this.saving.set(true)
		this.admin.deleteRole(role.id).subscribe({
			next: () => {
				this.saving.set(false)
				this.roles.update(list => list.filter(r => r.id !== role.id))
				if (this.editingRole()?.id === role.id) this.cancelRoleEdit()
				this.toast.toast({ severity: 'success', body: `Rol "${role.name}" eliminado.` })
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false)
				const msg = err.status === 409
					? `El rol "${role.name}" está en uso y no se puede eliminar.`
					: apiErrorMessage(err, 'Error al eliminar el rol.')
				this.toast.toast({ severity: 'error', body: msg })
			},
		})
	}
}
