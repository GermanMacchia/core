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
import type { Deployment, UpdateDeploymentInput } from '../../core/models/tenant.model'
import { apiErrorMessage } from '../../core/utils/api-error'

@Component({
	selector: 'app-deployments',
	standalone: true,
	imports: [CompactList, CompactListCellDirective, ReactiveFormsModule],
	template: `
		<div class="p-6 lg:p-10 max-w-6xl">
			<div class="flex items-center justify-between mb-6">
				<div>
					<h1 class="text-2xl font-bold text-base-content">Deploys</h1>
					<p class="text-base-content/50 text-sm">{{ deployments().length }} deploys registrados</p>
				</div>
				<button class="btn btn-primary btn-sm" (click)="openCreate()">
					<i class="bi bi-plus-lg"></i> Nuevo deploy
				</button>
			</div>

			<lib-compact-list
				[items]="deployments()"
				[columns]="columns"
				[actions]="actions"
				[loading]="loading()"
				[emptyIcon]="'bi bi-cloud-upload'"
				[emptyMessage]="'Sin deploys registrados'"
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

		<!-- Create / Edit Modal -->
		<dialog class="modal" [class.modal-open]="showForm()">
			<div class="modal-box w-11/12 max-w-lg flex flex-col p-0 max-h-[90vh]">
				<div class="px-6 py-4 border-b border-base-200">
					<h3 class="font-semibold text-lg">{{ editTarget() ? 'Editar deploy' : 'Nuevo deploy' }}</h3>
				</div>
				<form [formGroup]="form" class="flex flex-col overflow-hidden">
					<div class="px-6 py-5 flex-1 overflow-y-auto">
						<div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
							<label class="form-control md:col-span-2">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Nombre <span class="text-error text-xs">*</span></span></div>
								<input formControlName="name" type="text" class="input input-bordered" placeholder="core-manager">
							</label>
							<label class="form-control md:col-span-2">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">URL <span class="text-error text-xs">*</span></span></div>
								<input formControlName="url" type="text" class="input input-bordered" placeholder="http://localhost:4200/remoteEntry.js">
							</label>
							<label class="form-control md:col-span-2">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">API URL</span></div>
								<input formControlName="api_url" type="text" class="input input-bordered" placeholder="Opcional">
							</label>
							<label class="form-control">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Versión</span></div>
								<input formControlName="version" type="text" class="input input-bordered" placeholder="1.0.0">
							</label>
							@if (editTarget()) {
								<label class="form-control">
									<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Estado</span></div>
									<select formControlName="is_active" class="select select-bordered">
										<option [ngValue]="true">Activo</option>
										<option [ngValue]="false">Inactivo</option>
									</select>
								</label>
							}
							<label class="form-control md:col-span-2">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Descripción</span></div>
								<textarea formControlName="description" class="textarea textarea-bordered textarea-sm resize-none" rows="2"></textarea>
							</label>
						</div>
					</div>
					<div class="px-6 py-4 border-t border-base-200 flex justify-end gap-2">
						<button type="button" class="btn btn-ghost btn-sm" (click)="closeForm()">Cancelar</button>
						<button type="button" class="btn btn-primary btn-sm" [disabled]="saving()" (click)="onSubmit()">
							@if (saving()) { <span class="loading loading-spinner loading-xs"></span> }
							{{ editTarget() ? 'Guardar' : 'Crear' }}
						</button>
					</div>
				</form>
			</div>
			<form method="dialog" class="modal-backdrop" (click)="closeForm()"><button>close</button></form>
		</dialog>
	`,
})
export class DeploymentsComponent implements OnInit {
	private admin = inject(AdminService)
	private fb = inject(FormBuilder)
	private toast = inject(ToastService)
	private infoModal = inject(InfoModalService)

	deployments = signal<Deployment[]>([])
	loading = signal(true)
	saving = signal(false)
	showForm = signal(false)
	editTarget = signal<Deployment | null>(null)

	form = this.fb.nonNullable.group({
		name: ['', Validators.required],
		url: ['', Validators.required],
		api_url: [''],
		version: ['1.0.0'],
		description: [''],
		is_active: [true],
	})

	columns: CompactListColumn<Deployment>[] = [
		{ key: 'id', header: 'ID', type: 'custom' },
		{ key: 'name', prop: 'name', header: 'Nombre', type: 'text' },
		{ key: 'url', prop: 'url', header: 'URL', type: 'text' },
		{ key: 'version', prop: 'version', header: 'Versión', type: 'text' },
		{ key: 'is_active', prop: 'is_active', header: 'Activo', type: 'boolean' },
	]

	actions: CompactListAction<Deployment>[] = [
		{ id: 'edit', icon: 'bi bi-pencil', tooltip: 'Editar' },
		{ id: 'delete', icon: 'bi bi-trash', tooltip: 'Eliminar', class: 'text-error' },
	]

	ngOnInit() {
		this.load()
	}

	copyId(id: string) {
		navigator.clipboard.writeText(id).then(
			() => this.toast.toast({ severity: 'info', body: 'ID copiado al portapapeles.' }),
			() => this.toast.toast({ severity: 'error', body: 'No se pudo copiar el ID.' }),
		)
	}

	load() {
		this.loading.set(true)
		this.admin.listDeployments().subscribe({
			next: res => {
				this.deployments.set(res.data ?? [])
				this.loading.set(false)
			},
			error: (err: HttpErrorResponse) => {
				this.toast.toast({ severity: 'error', body: apiErrorMessage(err, 'Error al cargar los deploys.') })
				this.loading.set(false)
			},
		})
	}

	openCreate() {
		this.editTarget.set(null)
		this.form.reset()
		this.showForm.set(true)
	}

	closeForm() {
		this.showForm.set(false)
		this.editTarget.set(null)
	}

	onAction(event: { action: string; item: Deployment }) {
		if (event.action === 'edit') {
			this.editTarget.set(event.item)
			this.form.setValue({
				name: event.item.name,
				url: event.item.url,
				api_url: event.item.api_url ?? '',
				version: event.item.version,
				description: event.item.description ?? '',
				is_active: event.item.is_active,
			})
			this.showForm.set(true)
		} else if (event.action === 'delete') {
			this.infoModal.openAsConfirm(
				() => this.doDelete(event.item),
				`¿Eliminar el deploy "${event.item.name}"?`,
			)
		}
	}

	onSubmit() {
		if (this.form.invalid) {
			this.toast.toast({ severity: 'warning', body: 'Completá los campos requeridos.' })
			return
		}
		if (this.saving()) return
		const target = this.editTarget()
		if (target) {
			this.update(target)
		} else {
			this.create()
		}
	}

	private create() {
		const v = this.form.getRawValue()
		this.saving.set(true)
		this.admin.createDeployment({
			name: v.name.trim(),
			url: v.url.trim(),
			...(v.api_url ? { api_url: v.api_url.trim() } : {}),
			...(v.version ? { version: v.version.trim() } : {}),
			...(v.description ? { description: v.description } : {}),
		}).subscribe({
			next: res => {
				this.saving.set(false)
				this.deployments.update(list => [res.data, ...list])
				this.closeForm()
				this.toast.toast({ severity: 'success', body: `Deploy "${res.data.name}" creado.` })
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false)
				this.toast.toast({ severity: 'error', body: apiErrorMessage(err, 'Error al crear el deploy.') })
			},
		})
	}

	private update(target: Deployment) {
		const v = this.form.getRawValue()
		const body: UpdateDeploymentInput = {
			name: v.name.trim(),
			url: v.url.trim(),
			api_url: v.api_url.trim(),
			description: v.description,
			is_active: v.is_active,
		}
		if (v.version) body.version = v.version.trim()

		this.saving.set(true)
		this.admin.updateDeployment(target.id, body).subscribe({
			next: res => {
				this.saving.set(false)
				this.deployments.update(list => list.map(d => (d.id === res.data.id ? res.data : d)))
				this.closeForm()
				this.toast.toast({ severity: 'success', body: `Deploy "${res.data.name}" actualizado.` })
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false)
				this.toast.toast({ severity: 'error', body: apiErrorMessage(err, 'Error al actualizar el deploy.') })
			},
		})
	}

	private doDelete(deployment: Deployment) {
		if (this.saving()) return
		this.saving.set(true)
		this.admin.deleteDeployment(deployment.id).subscribe({
			next: () => {
				this.saving.set(false)
				this.deployments.update(list => list.filter(d => d.id !== deployment.id))
				this.toast.toast({ severity: 'success', body: `Deploy "${deployment.name}" eliminado.` })
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false)
				const msg = err.status === 409
					? `El deploy "${deployment.name}" tiene servicios asociados y no se puede eliminar.`
					: apiErrorMessage(err, 'Error al eliminar el deploy.')
				this.toast.toast({ severity: 'error', body: msg })
			},
		})
	}
}
