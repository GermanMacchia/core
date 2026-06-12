import { Component, inject, signal, computed, OnInit } from '@angular/core'
import { RouterLink } from '@angular/router'
import { CompactList, CompactListCellDirective } from '@germanmacchia/angular-ui'
import type { CompactListColumn } from '@germanmacchia/angular-ui'
import { AdminService } from '../../core/services/admin.service'
import { AuthService } from '../../core/services/auth.service'
import { Tenant } from '../../core/models/tenant.model'

const STATUS_BADGE: Record<string, string> = {
	active: 'badge-success',
	trial: 'badge-warning',
	suspended: 'badge-error',
	cancelled: 'badge-ghost',
}

@Component({
	selector: 'app-dashboard',
	standalone: true,
	imports: [RouterLink, CompactList, CompactListCellDirective],
	template: `
		<div class="p-6 lg:p-10">
			<div class="mb-8">
				<h1 class="text-2xl font-bold text-base-content">Panel de administración</h1>
				<p class="text-base-content/50 text-sm mt-0.5">
					Conectado como <strong>{{ auth.currentUser()?.email }}</strong>
					<span class="badge badge-sm badge-ghost ml-2">{{ auth.currentUser()?.role }}</span>
				</p>
			</div>

			<!-- Stats row -->
			<div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
				<div class="stat bg-base-100 border border-base-300 rounded-box shadow-sm">
					<div class="stat-figure text-primary">
						<i class="bi bi-building text-2xl"></i>
					</div>
					<div class="stat-title text-xs">Tenants totales</div>
					<div class="stat-value text-2xl">
						@if (loading()) { <span class="loading loading-dots loading-xs"></span> }
						@else { {{ tenants().length }} }
					</div>
					<div class="stat-desc">{{ active() }} activos</div>
				</div>

				<div class="stat bg-base-100 border border-base-300 rounded-box shadow-sm">
					<div class="stat-figure text-warning">
						<i class="bi bi-clock text-2xl"></i>
					</div>
					<div class="stat-title text-xs">En trial</div>
					<div class="stat-value text-2xl text-warning">
						@if (loading()) { <span class="loading loading-dots loading-xs"></span> }
						@else { {{ trial() }} }
					</div>
					<div class="stat-desc">pendientes de conversión</div>
				</div>

				<div class="stat bg-base-100 border border-base-300 rounded-box shadow-sm">
					<div class="stat-figure text-error">
						<i class="bi bi-x-circle text-2xl"></i>
					</div>
					<div class="stat-title text-xs">Suspendidos</div>
					<div class="stat-value text-2xl text-error">
						@if (loading()) { <span class="loading loading-dots loading-xs"></span> }
						@else { {{ suspended() }} }
					</div>
					<div class="stat-desc">requieren atención</div>
				</div>

				<div class="stat bg-base-100 border border-base-300 rounded-box shadow-sm">
					<div class="stat-figure text-secondary">
						<i class="bi bi-grid text-2xl"></i>
					</div>
					<div class="stat-title text-xs">Servicios en catálogo</div>
					<div class="stat-value text-2xl">
						@if (loadingServices()) { <span class="loading loading-dots loading-xs"></span> }
						@else { {{ serviceCount() }} }
					</div>
					<div class="stat-desc">registrados</div>
				</div>
			</div>

			<!-- Recent tenants table -->
			<div>
				<div class="flex items-center justify-between mb-3">
					<h2 class="font-semibold text-base-content">Tenants recientes</h2>
					<a routerLink="/tenants" class="btn btn-ghost btn-xs">
						Ver todos <i class="bi bi-arrow-right"></i>
					</a>
				</div>

				<lib-compact-list
					[items]="recent()"
					[columns]="columns"
					[loading]="loading()"
					[emptyIcon]="'bi bi-building'"
					[emptyMessage]="'Sin tenants registrados'"
					[trackByKey]="'id'">
					<ng-template compactListCell="status" let-item>
						<span class="badge badge-sm" [class]="statusBadge(item.status)">{{ item.status }}</span>
					</ng-template>
					<ng-template compactListCell="name" let-item>
						<a [routerLink]="['/tenants', item.id]" class="font-medium hover:text-primary">
							{{ item.name }}
						</a>
					</ng-template>
				</lib-compact-list>
			</div>
		</div>
	`,
})
export class DashboardComponent implements OnInit {
	protected auth = inject(AuthService)
	private admin = inject(AdminService)

	tenants = signal<Tenant[]>([])
	loading = signal(true)
	serviceCount = signal(0)
	loadingServices = signal(true)

	active    = computed(() => this.tenants().filter(t => t.status === 'active').length)
	trial     = computed(() => this.tenants().filter(t => t.status === 'trial').length)
	suspended = computed(() => this.tenants().filter(t => t.status === 'suspended').length)
	recent    = computed(() => [...this.tenants()].slice(0, 8))

	columns: CompactListColumn<Tenant>[] = [
		{ key: 'name', header: 'Nombre', type: 'custom' },
		{ key: 'slug', header: 'Slug', type: 'text' },
		{ key: 'plan', header: 'Plan', type: 'text', transform: t => t.plan?.name ?? '—' },
		{ key: 'status', header: 'Estado', type: 'custom' },
		{ key: 'created_at', header: 'Creado', type: 'text', transform: t => this.fmtDate(t.created_at) },
	]

	ngOnInit() {
		this.admin.listTenants(100, 0).subscribe({
			next: res => {
				this.tenants.set(res.data ?? [])
				this.loading.set(false)
			},
			error: () => this.loading.set(false),
		})

		this.admin.listServices().subscribe({
			next: res => {
				this.serviceCount.set(res.data?.length ?? 0)
				this.loadingServices.set(false)
			},
			error: () => this.loadingServices.set(false),
		})
	}

	statusBadge(status: string) {
		return STATUS_BADGE[status] ?? 'badge-ghost'
	}

	fmtDate(iso: string) {
		return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
	}
}
