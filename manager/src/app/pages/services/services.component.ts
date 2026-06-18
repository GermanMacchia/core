import { Component, inject, signal, OnInit } from '@angular/core'
import { FormBuilder, Validators } from '@angular/forms'
import {
	CompactList,
	Form,
	ToastService,
	InfoModalService,
} from '@germanmacchia/angular-ui'
import type { CompactListColumn, CompactListAction, FormField } from '@germanmacchia/angular-ui'
import { AdminService } from '../../core/services/admin.service'
import { Service } from '../../core/models/tenant.model'

@Component({
	selector: 'app-services',
	standalone: true,
	imports: [CompactList, Form],
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
				(actionClick)="onAction($event)" />
		</div>

		<lib-form
			[formGroup]="createForm"
			[fields]="createFields"
			[displayMode]="'modal'"
			[title]="'Nuevo servicio'"
			[isOpen]="showCreate()"
			(submitEvent)="onCreate()"
			(cancelEvent)="showCreate.set(false)" />

		<lib-form
			[formGroup]="editForm"
			[fields]="editFields"
			[displayMode]="'modal'"
			[title]="'Editar servicio'"
			[isOpen]="showEdit()"
			(submitEvent)="onUpdate()"
			(cancelEvent)="showEdit.set(false)" />
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

	createForm = this.fb.group({
		name: ['', Validators.required],
		version: ['1.0.0', Validators.required],
		mfe_url: ['', Validators.required],
		description: [''],
	})

	editForm = this.fb.group({
		name: [''],
		version: [''],
		mfe_url: [''],
		description: [''],
		is_active: [true],
	})

	createFields: FormField[] = [
		{ name: 'name', label: 'Nombre', type: 'text', required: true, placeholder: 'Mi Servicio' },
		{ name: 'version', label: 'Versión', type: 'text', required: true, placeholder: '1.0.0' },
		{ name: 'mfe_url', label: 'MFE URL', type: 'text', required: true, placeholder: 'http://localhost:4200/remoteEntry.js' },
		{ name: 'description', label: 'Descripción', type: 'textarea' },
	]

	editFields: FormField[] = [
		{ name: 'name', label: 'Nombre', type: 'text', placeholder: 'Mi Servicio' },
		{ name: 'version', label: 'Versión', type: 'text', placeholder: '1.0.0' },
		{ name: 'mfe_url', label: 'MFE URL', type: 'text', placeholder: 'http://localhost:4200/remoteEntry.js' },
		{ name: 'description', label: 'Descripción', type: 'textarea' },
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

	columns: CompactListColumn<Service>[] = [
		{ key: 'name', prop: 'name', header: 'Nombre', type: 'text' },
		{ key: 'version', prop: 'version', header: 'Versión', type: 'text' },
		{ key: 'mfe_url', prop: 'mfe_url', header: 'MFE URL', type: 'text' },
		{ key: 'description', header: 'Descripción', type: 'text', transform: s => s.description ?? '—' },
		{ key: 'is_active', prop: 'is_active', header: 'Activo', type: 'boolean' },
	]

	actions: CompactListAction<Service>[] = [
		{ id: 'edit', icon: 'bi bi-pencil', tooltip: 'Editar' },
		{ id: 'delete', icon: 'bi bi-trash', tooltip: 'Eliminar', class: 'text-error' },
	]

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
				this.toast.toast({ severity: 'error', body: 'Error al cargar los servicios.' })
				this.loading.set(false)
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
			})
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
		}).subscribe({
			next: res => {
				this.services.update(list => [res.data, ...list])
				this.showCreate.set(false)
				this.createForm.reset({ version: '1.0.0' })
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
