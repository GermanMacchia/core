import { Component, inject, signal, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { FormBuilder, Validators } from '@angular/forms'
import {
	CompactList,
	Form,
	ToastService,
	InfoModalService,
} from '@germanmacchia/angular-ui'
import type { CompactListColumn, CompactListAction, FormField } from '@germanmacchia/angular-ui'
import { AdminService } from '../../core/services/admin.service'
import { Plan } from '../../core/models/tenant.model'

@Component({
	selector: 'app-plans',
	standalone: true,
	imports: [CompactList, Form],
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

		<lib-form
			[formGroup]="createForm"
			[fields]="createFields"
			[displayMode]="'modal'"
			[title]="'Nuevo plan'"
			[isOpen]="showCreate()"
			(submitEvent)="onCreate()"
			(cancelEvent)="showCreate.set(false)" />
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

	createForm = this.fb.group({
		name: ['', Validators.required],
		max_users: [10, Validators.required],
		max_services: [5, Validators.required],
		price: [0, [Validators.required, Validators.min(0)]],
		features: ['{}'],
	})

	createFields: FormField[] = [
		{ name: 'name', label: 'Nombre', type: 'text', required: true, placeholder: 'Starter' },
		{ name: 'max_users', label: 'Máx. usuarios (-1 = ilimitado)', type: 'text', required: true, placeholder: '10' },
		{ name: 'max_services', label: 'Máx. servicios (-1 = ilimitado)', type: 'text', required: true, placeholder: '5' },
		{ name: 'price', label: 'Precio / mes', type: 'text', required: true, placeholder: '49' },
		{ name: 'features', label: 'Features (JSON)', type: 'text', placeholder: '{}' },
	]

	columns: CompactListColumn<Plan>[] = [
		{ key: 'name', prop: 'name', header: 'Nombre', type: 'text' },
		{
			key: 'max_users',
			header: 'Usuarios',
			type: 'text',
			transform: (p: Plan) => p.max_users === -1 ? 'Ilimitado' : String(p.max_users),
		},
		{
			key: 'max_services',
			header: 'Servicios',
			type: 'text',
			transform: (p: Plan) => p.max_services === -1 ? 'Ilimitado' : String(p.max_services),
		},
		{
			key: 'price',
			header: 'Precio',
			type: 'text',
			transform: (p: Plan) => `$${p.price}`,
		},
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

	onAction(event: { action: string; item: Plan }) {
		if (event.action === 'detail') {
			this.router.navigate(['/plans', event.item.id])
		} else if (event.action === 'delete') {
			this.infoModal.openAsConfirm(
				() => this.doDelete(event.item),
				`¿Eliminar el plan "${event.item.name}"? Esta acción afectará a los tenants que lo usen.`,
			)
		}
	}

	onCreate() {
		if (this.createForm.invalid) {
			this.toast.toast({ severity: 'warning', body: 'Completá los campos requeridos.' })
			return
		}
		const v = this.createForm.getRawValue()
		this.admin
			.createPlan({
				name: v.name!,
				max_users: Number(v.max_users),
				max_services: Number(v.max_services),
				price: Number(v.price),
				features: this.parseFeatures(v.features),
			})
			.subscribe({
				next: res => {
					this.plans.update(list => [...list, res.data])
					this.showCreate.set(false)
					this.createForm.reset({ max_users: 10, max_services: 5, price: 0, features: '{}' })
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

	private parseFeatures(s: string | null): Record<string, unknown> {
		try { return JSON.parse(s ?? '{}') } catch { return {} }
	}
}
