import { Component, inject, OnInit, signal } from '@angular/core'
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms'
import { Router } from '@angular/router'
import type { CompactListAction, CompactListColumn } from '@germanmacchia/angular-ui'
import { CompactList, CompactListCellDirective, ToastService } from '@germanmacchia/angular-ui'
import type { ConfigDefinition, Portal } from '../../core/models/tenant.model'
import { AdminService } from '../../core/services/admin.service'
import { ConfigEditorComponent } from '../../shared/config-editor.component'
import { buildConfigFromValues, defaultConfigValues, existingConfigToValues } from '../../shared/config-fields'

@Component({
	selector: 'app-portals',
	standalone: true,
	imports: [CompactList, CompactListCellDirective, ReactiveFormsModule, ConfigEditorComponent],
	template: `
		<div class="p-6 lg:p-10 max-w-6xl">
			<div class="flex items-center justify-between mb-6">
				<div>
					<h1 class="text-2xl font-bold text-base-content">Portales</h1>
					<p class="text-base-content/50 text-sm">{{ portals().length }} portales registrados</p>
				</div>
			</div>

			<lib-compact-list
				[items]="portals()"
				[columns]="columns"
				[actions]="actions"
				[loading]="loading()"
				[emptyIcon]="'bi bi-layout-three-columns'"
				[emptyMessage]="'Sin portales registrados'"
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
				<ng-template compactListCell="domain" let-item>
					<span class="text-xs text-base-content/60">{{ item.domain ?? '—' }}</span>
				</ng-template>
			</lib-compact-list>

			<!-- Edit Portal Modal -->
			<dialog class="modal" [class.modal-open]="showEditPortal()">
				<div class="modal-box w-11/12 max-w-lg flex flex-col p-0 max-h-[90vh]">
					<div class="px-6 py-4 border-b border-base-200">
						<h3 class="font-semibold text-lg">Editar portal</h3>
					</div>
					<form [formGroup]="editPortalForm" class="flex flex-col overflow-hidden">
						<div class="px-6 py-5 flex-1 overflow-y-auto">
							<div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
								<label class="form-control md:col-span-2">
									<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Nombre <span class="text-error text-xs">*</span></span></div>
									<input formControlName="name" type="text" class="input input-bordered" placeholder="Admin Portal">
								</label>
								<label class="form-control md:col-span-2">
									<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Dominio</span></div>
									<input formControlName="domain" type="text" class="input input-bordered" placeholder="admin.acme.com">
								</label>
								<label class="form-control md:col-span-2">
									<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Descripción</span></div>
									<input formControlName="description" type="text" class="input input-bordered" placeholder="Portal de administración">
								</label>
								<label class="form-control md:col-span-2">
									<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Estado</span></div>
									<select formControlName="is_active" class="select select-bordered">
										<option [ngValue]="true">Activo</option>
										<option [ngValue]="false">Inactivo</option>
									</select>
								</label>
							</div>
							<app-config-editor
								[defs]="portalConfigDefs()"
								[value]="editConfigValues()"
								(valueChange)="editConfigValues.set($event)" />
						</div>
						<div class="px-6 py-4 border-t border-base-200 flex justify-end gap-2">
							<button type="button" class="btn btn-ghost btn-sm" (click)="showEditPortal.set(false)">Cancelar</button>
							<button type="button" class="btn btn-primary btn-sm" (click)="onUpdatePortal()">Guardar</button>
						</div>
					</form>
				</div>
				<form method="dialog" class="modal-backdrop" (click)="showEditPortal.set(false)"><button>close</button></form>
			</dialog>
		</div>
	`,
})
export class PortalsComponent implements OnInit {
	private admin = inject(AdminService)
	private router = inject(Router)
	private toast = inject(ToastService)
	private fb = inject(FormBuilder)

	portals = signal<Portal[]>([])
	loading = signal(true)

	showEditPortal = signal(false)
	private editPortalTarget: Portal | null = null
	portalConfigDefs = signal<ConfigDefinition[]>([])
	editConfigValues = signal<Record<string, string>>({})

	editPortalForm = this.fb.group({
		name: ['', Validators.required],
		domain: [''],
		description: [''],
		is_active: [true],
	})

	columns: CompactListColumn<Portal>[] = [
		{ key: 'id', header: 'ID', type: 'custom' },
		{ key: 'name', prop: 'name', header: 'Nombre', type: 'text' },
		{ key: 'tenant_name', header: 'Tenant', type: 'text', transform: p => p.tenant_name ?? '—' },
		{ key: 'domain', header: 'Dominio', type: 'custom' },
		{ key: 'description', header: 'Descripción', type: 'text', transform: p => p.description ?? '—' },
		{ key: 'is_active', prop: 'is_active', header: 'Activo', type: 'boolean' },
	]

	actions: CompactListAction<Portal>[] = [
		{ id: 'edit', icon: 'bi bi-pencil', tooltip: 'Editar' },
		{ id: 'view-tenant', icon: 'bi bi-eye', tooltip: 'Ver tenant' },
	]

	ngOnInit() {
		this.load()
		this.loadConfigDefs()
	}

	loadConfigDefs() {
		this.admin.listConfigDefinitions().subscribe({
			next: res => {
				const portalDefs = (res.data ?? []).filter(d => d.scope === 'portal')
				this.portalConfigDefs.set(portalDefs)
				this.editConfigValues.set(defaultConfigValues(portalDefs))
			},
		})
	}

	load() {
		this.loading.set(true)
		this.admin.listAllPortals().subscribe({
			next: res => {
				this.portals.set(res.data ?? [])
				this.loading.set(false)
			},
			error: () => {
				this.toast.toast({ severity: 'error', body: 'Error al cargar los portales.' })
				this.loading.set(false)
			},
		})
	}

	copyId(id: string) {
		navigator.clipboard.writeText(id).then(
			() => this.toast.toast({ severity: 'info', body: 'ID copiado al portapapeles.' }),
			() => this.toast.toast({ severity: 'error', body: 'No se pudo copiar el ID.' }),
		)
	}

	onAction(event: { action: string; item: Portal }) {
		if (event.action === 'view-tenant') {
			this.router.navigate(['/tenants', event.item.tenant_id])
		} else if (event.action === 'edit') {
			this.editPortalTarget = event.item
			this.editPortalForm.patchValue({
				name: event.item.name,
				domain: event.item.domain ?? '',
				description: event.item.description ?? '',
				is_active: event.item.is_active,
			})
			this.editConfigValues.set(existingConfigToValues(event.item.config ?? {}, this.portalConfigDefs()))
			this.showEditPortal.set(true)
		}
	}

	onUpdatePortal() {
		const v = this.editPortalForm.getRawValue()
		if (!this.editPortalTarget || !v.name) {
			this.toast.toast({ severity: 'warning', body: 'El nombre es requerido.' })
			return
		}
		const body: { name?: string; domain?: string; description?: string; is_active?: boolean; config?: Record<string, unknown> } = { name: v.name }
		if (v.domain !== undefined) body.domain = v.domain || undefined
		if (v.description !== undefined) body.description = v.description || undefined
		body.is_active = v.is_active === true
		body.config = buildConfigFromValues(this.editConfigValues(), this.portalConfigDefs())

		this.admin.updatePortal(this.editPortalTarget.id, body).subscribe({
			next: res => {
				this.portals.update(list => list.map(p => (p.id === res.data.id ? res.data : p)))
				this.showEditPortal.set(false)
				this.editPortalTarget = null
				this.toast.toast({ severity: 'success', body: `Portal "${res.data.name}" actualizado.` })
			},
			error: err => {
				this.toast.toast({ severity: 'error', body: err.error?.error ?? 'Error al actualizar el portal.' })
			},
		})
	}
}
