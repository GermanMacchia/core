import { Component, inject, signal, OnInit } from '@angular/core'
import { FormBuilder, Validators } from '@angular/forms'
import {
	CompactList,
	CompactListCellDirective,
	Form,
	ToastService,
	InfoModalService,
} from '@germanmacchia/angular-ui'
import type { CompactListColumn, CompactListAction, FormField } from '@germanmacchia/angular-ui'
import { AdminService } from '../../core/services/admin.service'
import { ConfigDefinition } from '../../core/models/tenant.model'

@Component({
	selector: 'app-config-definitions',
	standalone: true,
	imports: [CompactList, CompactListCellDirective, Form],
	template: `
		<div class="p-6 lg:p-10 max-w-6xl">
			<div class="flex items-center justify-between mb-6">
				<div>
					<h1 class="text-2xl font-bold text-base-content">Definiciones de configuración</h1>
					<p class="text-base-content/50 text-sm">{{ configDefinitions().length }} definiciones registradas</p>
				</div>
				<button class="btn btn-primary btn-sm" (click)="showCreate.set(true)">
					<i class="bi bi-plus-lg"></i> Nueva definición
				</button>
			</div>

			<lib-compact-list
				[items]="configDefinitions()"
				[columns]="columns"
				[actions]="actions"
				[loading]="loading()"
				[emptyIcon]="'bi bi-sliders'"
				[emptyMessage]="'Sin definiciones de configuración'"
				[pageSize]="20"
				[trackByKey]="'id'"
				(actionClick)="onAction($event)">
				<ng-template compactListCell="scope" let-item>
					<span class="badge badge-sm font-medium" [class]="scopeBadge(item.scope)">{{ item.scope }}</span>
				</ng-template>
				<ng-template compactListCell="type" let-item>
					<span class="badge badge-sm font-medium badge-outline" [class]="typeBadge(item.type)">{{ item.type }}</span>
				</ng-template>
			</lib-compact-list>
		</div>

		<lib-form
			[formGroup]="createForm"
			[fields]="createFields"
			[displayMode]="'modal'"
			[title]="'Nueva definición'"
			[isOpen]="showCreate()"
			(submitEvent)="onCreate()"
			(cancelEvent)="showCreate.set(false)" />

		<lib-form
			[formGroup]="editForm"
			[fields]="editFields"
			[displayMode]="'modal'"
			[title]="'Editar definición'"
			[isOpen]="showEdit()"
			(submitEvent)="onUpdate()"
			(cancelEvent)="showEdit.set(false)" />
	`,
})
export class ConfigDefinitionsComponent implements OnInit {
	private admin = inject(AdminService)
	private fb = inject(FormBuilder)
	private toast = inject(ToastService)
	private infoModal = inject(InfoModalService)

	configDefinitions = signal<ConfigDefinition[]>([])
	loading = signal(true)
	showCreate = signal(false)
	showEdit = signal(false)
	private editTarget: ConfigDefinition | null = null

	createForm = this.fb.group({
		key: ['', [Validators.required, Validators.maxLength(100)]],
		scope: ['service', Validators.required],
		type: ['string', Validators.required],
		description: [''],
		default_val: [''],
	})

	editForm = this.fb.group({
		type: ['string', Validators.required],
		description: [''],
		default_val: [''],
	})

	createFields: FormField[] = [
		{ name: 'key', label: 'Key (Nombre único)', type: 'text', required: true, placeholder: 'allowed_roles' },
		{
			name: 'scope',
			label: 'Scope',
			type: 'select',
			required: true,
			options: [
				{ label: 'Service (Servicio)', value: 'service' },
				{ label: 'Portal (Portal)', value: 'portal' },
				{ label: 'Tenant (Tenant/Cliente)', value: 'tenant' },
				{ label: 'Plan (Plan)', value: 'plan' },
			],
		},
		{
			name: 'type',
			label: 'Tipo de dato',
			type: 'select',
			required: true,
			options: [
				{ label: 'Boolean (bool)', value: 'bool' },
				{ label: 'String (Texto)', value: 'string' },
				{ label: 'String Array (Lista de textos)', value: 'string[]' },
			],
		},
		{ name: 'description', label: 'Descripción', type: 'textarea', placeholder: 'Especifica la función de esta configuración...' },
		{ name: 'default_val', label: 'Valor por defecto (Opcional)', type: 'text', placeholder: 'Ej: false, 1.0.0, etc.' },
	]

	editFields: FormField[] = [
		{
			name: 'type',
			label: 'Tipo de dato',
			type: 'select',
			required: true,
			options: [
				{ label: 'Boolean (bool)', value: 'bool' },
				{ label: 'String (Texto)', value: 'string' },
				{ label: 'String Array (Lista de textos)', value: 'string[]' },
			],
		},
		{ name: 'description', label: 'Descripción', type: 'textarea', placeholder: 'Especifica la función de esta configuración...' },
		{ name: 'default_val', label: 'Valor por defecto (Opcional)', type: 'text', placeholder: 'Ej: false, 1.0.0, etc.' },
	]

	columns: CompactListColumn<ConfigDefinition>[] = [
		{ key: 'key', prop: 'key', header: 'Key', type: 'text' },
		{ key: 'scope', header: 'Scope', type: 'custom' },
		{ key: 'type', header: 'Tipo', type: 'custom' },
		{ key: 'description', header: 'Descripción', type: 'text', transform: c => c.description ?? '—' },
		{ key: 'default_val', header: 'Por defecto', type: 'text', transform: c => c.default_val ?? '—' },
	]

	actions: CompactListAction<ConfigDefinition>[] = [
		{ id: 'edit', icon: 'bi bi-pencil', tooltip: 'Editar' },
		{ id: 'delete', icon: 'bi bi-trash', tooltip: 'Eliminar', class: 'text-error' },
	]

	ngOnInit() {
		this.load()
	}

	load() {
		this.loading.set(true)
		this.admin.listConfigDefinitions().subscribe({
			next: res => {
				const mapped = (res.data ?? []).map(item => ({
					...item,
					id: `${item.scope}:${item.key}`,
				}))
				this.configDefinitions.set(mapped)
				this.loading.set(false)
			},
			error: () => {
				this.toast.toast({ severity: 'error', body: 'Error al cargar las definiciones de configuración.' })
				this.loading.set(false)
			},
		})
	}

	onAction(event: { action: string; item: ConfigDefinition }) {
		if (event.action === 'edit') {
			this.editTarget = event.item
			this.editForm.patchValue({
				type: event.item.type,
				description: event.item.description ?? '',
				default_val: event.item.default_val ?? '',
			})
			this.showEdit.set(true)
		} else if (event.action === 'delete') {
			this.infoModal.openAsConfirm(
				() => this.doDelete(event.item),
				`¿Eliminar la definición de configuración "${event.item.key}" (scope: ${event.item.scope})?`,
			)
		}
	}

	onCreate() {
		if (this.createForm.invalid) {
			this.toast.toast({ severity: 'warning', body: 'Completá los campos requeridos.' })
			return
		}
		const v = this.createForm.getRawValue()
		this.admin.createConfigDefinition({
			key: v.key!,
			scope: v.scope!,
			type: v.type!,
			description: v.description || null,
			default_val: v.default_val || null,
		}).subscribe({
			next: res => {
				const newItem: ConfigDefinition = {
					...res.data,
					id: `${res.data.scope}:${res.data.key}`,
				}
				this.configDefinitions.update(list => [newItem, ...list])
				this.showCreate.set(false)
				this.createForm.reset({ scope: 'service', type: 'string' })
				this.toast.toast({ severity: 'success', body: `Definición "${res.data.key}" creada.` })
			},
			error: err => {
				this.toast.toast({ severity: 'error', body: err.error?.error ?? 'Error al crear la definición.' })
			},
		})
	}

	onUpdate() {
		if (!this.editTarget) return
		if (this.editForm.invalid) {
			this.toast.toast({ severity: 'warning', body: 'Completá los campos requeridos.' })
			return
		}
		const v = this.editForm.getRawValue()

		this.admin.updateConfigDefinition(this.editTarget.scope, this.editTarget.key, {
			type: v.type!,
			description: v.description || null,
			default_val: v.default_val || null,
		}).subscribe({
			next: res => {
				const updatedItem: ConfigDefinition = {
					...res.data,
					id: `${res.data.scope}:${res.data.key}`,
				}
				this.configDefinitions.update(list => list.map(item => item.id === updatedItem.id ? updatedItem : item))
				this.showEdit.set(false)
				this.editTarget = null
				this.toast.toast({ severity: 'success', body: `Definición "${res.data.key}" actualizada.` })
			},
			error: err => {
				this.toast.toast({ severity: 'error', body: err.error?.error ?? 'Error al actualizar la definición.' })
			},
		})
	}

	private doDelete(item: ConfigDefinition) {
		this.admin.deleteConfigDefinition(item.scope, item.key).subscribe({
			next: () => {
				this.configDefinitions.update(list => list.filter(c => c.id !== item.id))
				this.toast.toast({ severity: 'success', body: `Definición "${item.key}" eliminada.` })
			},
			error: () => {
				this.toast.toast({ severity: 'error', body: 'Error al eliminar la definición.' })
			},
		})
	}

	scopeBadge(scope: string): string {
		switch (scope) {
			case 'service': return 'badge-primary text-primary-content'
			case 'portal': return 'badge-secondary text-secondary-content'
			case 'tenant': return 'badge-accent text-accent-content'
			case 'plan': return 'badge-neutral text-neutral-content'
			default: return 'badge-ghost'
		}
	}

	typeBadge(type: string): string {
		switch (type) {
			case 'bool': return 'badge-info'
			case 'string': return 'badge-warning'
			case 'string[]': return 'badge-success'
			default: return 'badge-ghost'
		}
	}
}
