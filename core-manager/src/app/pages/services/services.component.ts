import { Component, inject, signal, OnInit } from '@angular/core'
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms'
import {
	CompactList,
	CompactListCellDirective,
	ToastService,
	InfoModalService,
} from '@germanmacchia/angular-ui'
import type { CompactListColumn, CompactListAction } from '@germanmacchia/angular-ui'
import { AdminService } from '../../core/services/admin.service'
import { ConfigDefinition, Service } from '../../core/models/tenant.model'
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
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Versión <span class="text-error text-xs">*</span></span></div>
								<input formControlName="version" type="text" class="input input-bordered" placeholder="1.0.0">
							</label>
							<label class="form-control md:col-span-2">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">MFE URL <span class="text-error text-xs">*</span></span></div>
								<input formControlName="mfe_url" type="text" class="input input-bordered" placeholder="http://localhost:4200/remoteEntry.js">
							</label>
							<label class="form-control md:col-span-2">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Descripción</span></div>
								<textarea formControlName="description" class="textarea textarea-bordered textarea-sm resize-none" rows="2"></textarea>
							</label>
							<label class="label cursor-pointer justify-start gap-2 md:col-span-2">
								<input formControlName="requires_instance" type="checkbox" class="checkbox checkbox-sm">
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
						<button type="button" class="btn btn-primary btn-sm" (click)="onCreate()">Crear</button>
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
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Versión</span></div>
								<input formControlName="version" type="text" class="input input-bordered" placeholder="1.0.0">
							</label>
							<label class="form-control md:col-span-2">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">MFE URL</span></div>
								<input formControlName="mfe_url" type="text" class="input input-bordered" placeholder="http://localhost:4200/remoteEntry.js">
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
								<input formControlName="requires_instance" type="checkbox" class="checkbox checkbox-sm">
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
						<button type="button" class="btn btn-primary btn-sm" (click)="onUpdate()">Guardar</button>
					</div>
				</form>
			</div>
			<form method="dialog" class="modal-backdrop" (click)="showEdit.set(false)"><button>close</button></form>
		</dialog>
	`,
})
export class ServicesComponent implements OnInit {
	private admin = inject(AdminService)
	private fb = inject(FormBuilder)
	private toast = inject(ToastService)
	private infoModal = inject(InfoModalService)

	services = signal<Service[]>([])
	loading = signal(true)
	showCreate = signal(false)
	showEdit = signal(false)
	private editTarget: Service | null = null

	configDefs = signal<ConfigDefinition[]>([])
	createConfigValues = signal<Record<string, string>>({})
	editConfigValues = signal<Record<string, string>>({})

	createForm = this.fb.group({
		name: ['', Validators.required],
		version: ['1.0.0', Validators.required],
		mfe_url: ['', Validators.required],
		description: [''],
		requires_instance: [true],
	})

	editForm = this.fb.group({
		name: [''],
		version: [''],
		mfe_url: [''],
		description: [''],
		is_active: [true],
		requires_instance: [true],
	})

	columns: CompactListColumn<Service>[] = [
		{ key: 'id', header: 'ID', type: 'custom' },
		{ key: 'name', prop: 'name', header: 'Nombre', type: 'text' },
		{ key: 'version', prop: 'version', header: 'Versión', type: 'text' },
		{ key: 'mfe_url', prop: 'mfe_url', header: 'MFE URL', type: 'text' },
		{ key: 'description', header: 'Descripción', type: 'text', transform: s => s.description ?? '—' },
		{ key: 'is_active', prop: 'is_active', header: 'Activo', type: 'boolean' },
		{ key: 'requires_instance', prop: 'requires_instance', header: 'Requiere negocio', type: 'boolean' },
	]

	actions: CompactListAction<Service>[] = [
		{ id: 'edit', icon: 'bi bi-pencil', tooltip: 'Editar' },
		{ id: 'delete', icon: 'bi bi-trash', tooltip: 'Eliminar', class: 'text-error' },
	]

	ngOnInit() {
		this.load()
		this.loadConfigDefs()
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
			error: () => {
				this.toast.toast({ severity: 'error', body: 'Error al cargar los servicios.' })
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
		})
	}

	onAction(event: { action: string; item: Service }) {
		if (event.action === 'edit') {
			this.editTarget = event.item
			this.editForm.patchValue({
				name: event.item.name,
				version: event.item.version,
				mfe_url: event.item.mfe_url,
				description: event.item.description ?? '',
				is_active: event.item.is_active,
				requires_instance: event.item.requires_instance,
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
		const v = this.createForm.getRawValue()
		this.admin.createService({
			name: v.name!,
			version: v.version!,
			mfe_url: v.mfe_url!,
			...(v.description ? { description: v.description } : {}),
			config: buildConfigFromValues(this.createConfigValues(), this.configDefs()),
			requires_instance: v.requires_instance ?? true,
		}).subscribe({
			next: res => {
				this.services.update(list => [res.data, ...list])
				this.showCreate.set(false)
				this.createForm.reset({ version: '1.0.0', requires_instance: true })
				this.createConfigValues.set(defaultConfigValues(this.configDefs()))
				this.toast.toast({ severity: 'success', body: `Servicio "${res.data.name}" creado.` })
			},
			error: err => {
				this.toast.toast({ severity: 'error', body: err.error?.error ?? 'Error al crear el servicio.' })
			},
		})
	}

	onUpdate() {
		if (!this.editTarget) return
		const v = this.editForm.getRawValue()
		const body: Parameters<AdminService['updateService']>[1] = {}
		if (v.name) body.name = v.name
		if (v.version) body.version = v.version
		if (v.mfe_url) body.mfe_url = v.mfe_url
		if (v.description !== null) body.description = v.description ?? undefined
		if (v.is_active !== null) body.is_active = v.is_active!
		if (v.requires_instance !== null) body.requires_instance = v.requires_instance!
		body.config = buildConfigFromValues(this.editConfigValues(), this.configDefs())

		this.admin.updateService(this.editTarget.id, body).subscribe({
			next: res => {
				this.services.update(list => list.map(s => s.id === res.data.id ? res.data : s))
				this.showEdit.set(false)
				this.editTarget = null
				this.toast.toast({ severity: 'success', body: `Servicio "${res.data.name}" actualizado.` })
			},
			error: err => {
				this.toast.toast({ severity: 'error', body: err.error?.error ?? 'Error al actualizar el servicio.' })
			},
		})
	}

	private doDelete(svc: Service) {
		this.admin.deleteService(svc.id).subscribe({
			next: () => {
				this.services.update(list => list.filter(s => s.id !== svc.id))
				this.toast.toast({ severity: 'success', body: `Servicio "${svc.name}" eliminado.` })
			},
			error: () => {
				this.toast.toast({ severity: 'error', body: 'Error al eliminar el servicio.' })
			},
		})
	}
}
