import { Component, inject, OnInit, signal } from '@angular/core'
import { FormBuilder, Validators } from '@angular/forms'
import { Router } from '@angular/router'
import type { CompactListAction, CompactListColumn, FormField } from '@germanmacchia/angular-ui'
import {
	CompactList,
	CompactListCellDirective,
	Form,
	InfoModalService,
	ToastService,
} from '@germanmacchia/angular-ui'
import { Plan, Tenant } from '../../core/models/tenant.model'
import { AdminService } from '../../core/services/admin.service'

const STATUS_BADGE: Record<string, string> = {
	active: 'badge-success',
	trial: 'badge-warning',
	suspended: 'badge-error',
	cancelled: 'badge-ghost',
}

@Component({
	selector: 'app-tenants',
	standalone: true,
	imports: [CompactList, CompactListCellDirective, Form],
	template: `
		<div class="p-6 lg:p-10">
			<div class="flex items-center justify-between mb-6">
				<div>
					<h1 class="text-2xl font-bold text-base-content">Tenants</h1>
					<p class="text-base-content/50 text-sm">{{ tenants().length }} registrados</p>
				</div>
				<button class="btn btn-primary btn-sm" (click)="showCreate.set(true)">
					<i class="bi bi-plus-lg"></i> Nuevo tenant
				</button>
			</div>

			<lib-compact-list
				[items]="tenants()"
				[columns]="columns"
				[actions]="actions"
				[loading]="loading()"
				[emptyIcon]="'bi bi-building'"
				[emptyMessage]="'Sin tenants registrados'"
				[pageSize]="20"
				[trackByKey]="'id'"
				(actionClick)="onAction($event)">
				<ng-template compactListCell="status" let-item>
					<span class="badge badge-sm" [class]="statusBadge(item.status)">{{ item.status }}</span>
				</ng-template>
				<ng-template compactListCell="created_at" let-item>
					<span class="text-xs text-base-content/60">{{ fmtDate(item.created_at) }}</span>
				</ng-template>
			</lib-compact-list>
		</div>

		<lib-form
			[formGroup]="createForm"
			[fields]="createFields()"
			[displayMode]="'modal'"
			[title]="'Nuevo tenant'"
			[isOpen]="showCreate()"
			(submitEvent)="onCreate()"
			(cancelEvent)="showCreate.set(false)" />
	`,
})
export class TenantsComponent implements OnInit {
	private admin = inject(AdminService)
	private router = inject(Router)
	private fb = inject(FormBuilder)
	private toast = inject(ToastService)
	private infoModal = inject(InfoModalService)

	tenants = signal<Tenant[]>([])
	loading = signal(true)
	showCreate = signal(false)
	plans = signal<Plan[]>([])

	createForm = this.fb.group({
		name: ['', Validators.required],
		domain: [''],
		plan_id: ['', Validators.required],
	})

	createFields = signal<FormField[]>([
		{ name: 'name', label: 'Nombre', type: 'text', required: true, placeholder: 'Acme Corp' },
		{ name: 'domain', label: 'Dominio', type: 'text', placeholder: 'acme.example.com' },
		{ name: 'plan_id', label: 'Plan', type: 'select', required: true, options: [] },
	])

	columns: CompactListColumn<Tenant>[] = [
		{ key: 'name', prop: 'name', header: 'Nombre', type: 'text' },
		{ key: 'domain', header: 'Dominio', type: 'text', transform: t => t.domain ?? '—' },
		{ key: 'plan', header: 'Plan', type: 'text', transform: t => t.plan?.name ?? '—' },
		{ key: 'status', header: 'Estado', type: 'custom' },
		{ key: 'created_at', header: 'Creado', type: 'custom' },
	]

	actions: CompactListAction<Tenant>[] = [
		{ id: 'view', icon: 'bi bi-eye', tooltip: 'Ver detalle' },
		{ id: 'delete', icon: 'bi bi-trash', tooltip: 'Eliminar', class: 'text-error' },
	]

	ngOnInit() {
		this.loadPlans()
		this.load()
	}

	loadPlans() {
		this.admin.listPlans().subscribe({
			next: res => {
				this.plans.set(res.data ?? [])
				this.createFields.update(fields =>
					fields.map(f =>
						f.name === 'plan_id'
							? {
									...f,
									options: (res.data ?? []).map(p => ({
										label: `${p.name} ($${p.price})`,
										value: p.id,
									})),
								}
							: f,
					),
				)
			},
		})
	}

	load() {
		this.loading.set(true)
		this.admin.listTenants(100, 0).subscribe({
			next: res => {
				this.tenants.set(res.data ?? [])
				this.loading.set(false)
			},
			error: () => {
				this.toast.toast({ severity: 'error', body: 'Error al cargar los tenants.' })
				this.loading.set(false)
			},
		})
	}

	onAction(event: { action: string; item: Tenant }) {
		if (event.action === 'view') {
			this.router.navigate(['/tenants', event.item.id])
		} else if (event.action === 'delete') {
			this.infoModal.openAsConfirm(
				() => this.doDelete(event.item),
				`¿Eliminar el tenant "${event.item.name}"?`,
			)
		}
	}

	onCreate() {
		if (this.createForm.invalid) {
			this.toast.toast({ severity: 'warning', body: 'Completá todos los campos requeridos.' })
			return
		}
		const v = this.createForm.getRawValue()
		const body: { name: string; plan_id: string; domain?: string } = {
			name: v.name!,
			plan_id: v.plan_id!,
		}
		if (v.domain) body.domain = v.domain

		this.admin.createTenant(body).subscribe({
			next: res => {
				this.tenants.update(list => [res.data, ...list])
				this.showCreate.set(false)
				this.createForm.reset()
				this.toast.toast({ severity: 'success', body: `Tenant "${res.data.name}" creado.` })
			},
			error: err => {
				this.toast.toast({
					severity: 'error',
					body: err.error?.error ?? 'Error al crear el tenant.',
				})
			},
		})
	}

	private doDelete(tenant: Tenant) {
		this.admin.deleteTenant(tenant.id).subscribe({
			next: () => {
				this.tenants.update(list => list.filter(t => t.id !== tenant.id))
				this.toast.toast({ severity: 'success', body: `Tenant "${tenant.name}" eliminado.` })
			},
			error: () => {
				this.toast.toast({ severity: 'error', body: 'Error al eliminar el tenant.' })
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
