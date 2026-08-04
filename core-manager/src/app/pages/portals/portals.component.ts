import { Component, inject, OnInit, signal } from '@angular/core'
import { Router } from '@angular/router'
import type { CompactListAction, CompactListColumn } from '@germanmacchia/angular-ui'
import { CompactList, CompactListCellDirective, ToastService } from '@germanmacchia/angular-ui'
import { Portal } from '../../core/models/tenant.model'
import { AdminService } from '../../core/services/admin.service'

@Component({
	selector: 'app-portals',
	standalone: true,
	imports: [CompactList, CompactListCellDirective],
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
				<ng-template compactListCell="domain" let-item>
					<span class="text-xs text-base-content/60">{{ item.domain ?? '—' }}</span>
				</ng-template>
			</lib-compact-list>
		</div>
	`,
})
export class PortalsComponent implements OnInit {
	private admin = inject(AdminService)
	private router = inject(Router)
	private toast = inject(ToastService)

	portals = signal<Portal[]>([])
	loading = signal(true)

	columns: CompactListColumn<Portal>[] = [
		{ key: 'name', prop: 'name', header: 'Nombre', type: 'text' },
		{ key: 'tenant_name', header: 'Tenant', type: 'text', transform: p => p.tenant_name ?? '—' },
		{ key: 'domain', header: 'Dominio', type: 'custom' },
		{ key: 'description', header: 'Descripción', type: 'text', transform: p => p.description ?? '—' },
		{ key: 'is_active', prop: 'is_active', header: 'Activo', type: 'boolean' },
	]

	actions: CompactListAction<Portal>[] = [{ id: 'view-tenant', icon: 'bi bi-eye', tooltip: 'Ver tenant' }]

	ngOnInit() {
		this.load()
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

	onAction(event: { action: string; item: Portal }) {
		if (event.action === 'view-tenant') {
			this.router.navigate(['/tenants', event.item.tenant_id])
		}
	}
}
