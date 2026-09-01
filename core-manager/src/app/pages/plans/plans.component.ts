import { Component, inject, signal, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms'
import {
	CompactList,
	ToastService,
	InfoModalService,
} from '@germanmacchia/angular-ui'
import type { CompactListColumn, CompactListAction } from '@germanmacchia/angular-ui'
import { AdminService } from '../../core/services/admin.service'
import { ConfigDefinition, Plan } from '../../core/models/tenant.model'
import { ConfigEditorComponent } from '../../shared/config-editor.component'
import { buildConfigFromValues, defaultConfigValues } from '../../shared/config-fields'

@Component({
	selector: 'app-plans',
	standalone: true,
	imports: [CompactList, ReactiveFormsModule, ConfigEditorComponent],
	template: `
		<div class="p-6 lg:p-10 max-w-6xl">
			<div class="flex items-center justify-between mb-6">
				<div>
					<h1 class="text-2xl font-bold text-base-content">Planes</h1>
					<p class="text-base-content/50 text-sm">{{ plans().length }} planes registrados</p>
				</div>
				<button class="btn btn-primary btn-sm" (click)="showCreate.set(true)">
					<i class="bi bi-plus-lg"></i> Nuevo plan
				</button>
			</div>

			<lib-compact-list
				[items]="plans()"
				[columns]="columns"
				[actions]="actions"
				[loading]="loading()"
				[emptyIcon]="'bi bi-credit-card'"
				[emptyMessage]="'Sin planes registrados'"
				[pageSize]="20"
				[trackByKey]="'id'"
				(actionClick)="onAction($event)" />
		</div>

		<!-- Create Modal -->
		<dialog class="modal" [class.modal-open]="showCreate()">
			<div class="modal-box w-11/12 max-w-lg flex flex-col p-0 max-h-[90vh]">
				<div class="px-6 py-4 border-b border-base-200">
					<h3 class="font-semibold text-lg">Nuevo plan</h3>
				</div>
				<form [formGroup]="createForm" class="flex flex-col overflow-hidden">
					<div class="px-6 py-5 flex-1 overflow-y-auto">
						<div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
							<label class="form-control md:col-span-2">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Nombre <span class="text-error text-xs">*</span></span></div>
								<input formControlName="name" type="text" class="input input-bordered" placeholder="Starter">
							</label>
							<label class="form-control">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Máx. usuarios <span class="text-error text-xs">*</span></span></div>
								<input formControlName="max_users" type="number" class="input input-bordered" placeholder="-1">
							</label>
							<label class="form-control">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Máx. servicios <span class="text-error text-xs">*</span></span></div>
								<input formControlName="max_services" type="number" class="input input-bordered" placeholder="-1">
							</label>
							<label class="form-control md:col-span-2">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Precio / mes <span class="text-error text-xs">*</span></span></div>
								<input formControlName="price" type="number" class="input input-bordered" placeholder="49">
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
	`,
})
export class PlansComponent implements OnInit {
	private admin = inject(AdminService)
	private router = inject(Router)
	private fb = inject(FormBuilder)
	private toast = inject(ToastService)
	private infoModal = inject(InfoModalService)

	plans = signal<Plan[]>([])
	loading = signal(true)
	showCreate = signal(false)

	configDefs = signal<ConfigDefinition[]>([])
	createConfigValues = signal<Record<string, string>>({})

	createForm = this.fb.group({
		name: ['', Validators.required],
		max_users: [10, Validators.required],
		max_services: [5, Validators.required],
		price: [0, [Validators.required, Validators.min(0)]],
	})

	columns: CompactListColumn<Plan>[] = [
		{ key: 'name', prop: 'name', header: 'Nombre', type: 'text' },
		{
			key: 'max_users',
			header: 'Máx. usuarios',
			type: 'text',
			transform: (p: Plan) => p.max_users === -1 ? 'Ilimitado' : String(p.max_users),
		},
		{
			key: 'max_services',
			header: 'Máx. servicios',
			type: 'text',
			transform: (p: Plan) => p.max_services === -1 ? 'Ilimitado' : String(p.max_services),
		},
		{ key: 'price', header: 'Precio', type: 'text', transform: (p: Plan) => `$${p.price}` },
		{
			key: 'features',
			header: 'Features',
			type: 'text',
			transform: (p: Plan) => {
				const count = Object.keys(p.features ?? {}).length
				return count ? `${count} feature${count !== 1 ? 's' : ''}` : '—'
			},
		},
	]

	actions: CompactListAction<Plan>[] = [
		{ id: 'detail', icon: 'bi bi-eye', tooltip: 'Ver detalle' },
		{ id: 'delete', icon: 'bi bi-trash', tooltip: 'Eliminar', class: 'text-error' },
	]

	ngOnInit() {
		this.load()
		this.loadConfigDefs()
	}

	load() {
		this.loading.set(true)
		this.admin.listPlans().subscribe({
			next: res => {
				this.plans.set(res.data ?? [])
				this.loading.set(false)
			},
			error: () => {
				this.toast.toast({ severity: 'error', body: 'Error al cargar los planes.' })
				this.loading.set(false)
			},
		})
	}

	loadConfigDefs() {
		this.admin.listConfigDefinitions().subscribe({
			next: res => {
				const defs = (res.data ?? []).filter(d => d.scope === 'plan')
				this.configDefs.set(defs)
				this.createConfigValues.set(defaultConfigValues(defs))
			},
		})
	}

	onAction(event: { action: string; item: Plan }) {
		if (event.action === 'detail') {
			this.router.navigate(['/plans', event.item.id])
		} else if (event.action === 'delete') {
			this.infoModal.openAsConfirm(
				() => this.doDelete(event.item),
				`¿Eliminar el plan "${event.item.name}"? Esta acción afectará los tenants que lo usen.`,
			)
		}
	}

	onCreate() {
		if (this.createForm.invalid) {
			this.toast.toast({ severity: 'warning', body: 'Completá los campos requeridos.' })
			return
		}
		const v = this.createForm.getRawValue()
		this.admin.createPlan({
			name: v.name!,
			max_users: Number(v.max_users),
			max_services: Number(v.max_services),
			price: Number(v.price),
			features: buildConfigFromValues(this.createConfigValues(), this.configDefs()),
		}).subscribe({
			next: res => {
				this.plans.update(list => [res.data, ...list])
				this.showCreate.set(false)
				this.createForm.reset({ max_users: 10, max_services: 5, price: 0 })
				this.createConfigValues.set(defaultConfigValues(this.configDefs()))
				this.toast.toast({ severity: 'success', body: `Plan "${res.data.name}" creado.` })
			},
			error: err => {
				this.toast.toast({ severity: 'error', body: err.error?.error ?? 'Error al crear el plan.' })
			},
		})
	}

	private doDelete(plan: Plan) {
		this.admin.deletePlan(plan.id).subscribe({
			next: () => {
				this.plans.update(list => list.filter(p => p.id !== plan.id))
				this.toast.toast({ severity: 'success', body: `Plan "${plan.name}" eliminado.` })
			},
			error: () => {
				this.toast.toast({ severity: 'error', body: 'Error al eliminar el plan.' })
			},
		})
	}
}
