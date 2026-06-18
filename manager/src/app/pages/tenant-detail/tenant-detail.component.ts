import { Component, inject, Input, OnInit, signal } from '@angular/core'
import { RouterLink } from '@angular/router'
import type { Tenant } from '../../core/models/tenant.model'
import { AdminService } from '../../core/services/admin.service'
import { TenantOverviewComponent } from './tenant-overview/tenant-overview.component'
import { TenantPortalsComponent } from './tenant-portals/tenant-portals.component'
import { TenantUsersComponent } from './tenant-users/tenant-users.component'

type Tab = 'overview' | 'portals' | 'users'

const STATUS_BADGE: Record<string, string> = {
  active: 'badge-success',
  trial: 'badge-warning',
  suspended: 'badge-error',
  cancelled: 'badge-ghost',
}

@Component({
  selector: 'app-tenant-detail',
  standalone: true,
  imports: [RouterLink, TenantOverviewComponent, TenantPortalsComponent, TenantUsersComponent],
  template: `
    <div class="p-6 lg:p-10">
      <div class="mb-2">
        <a routerLink="/tenants" class="text-xs text-base-content/40 hover:text-base-content">
          <i class="bi bi-arrow-left"></i> Tenants
        </a>
      </div>

      @if (loadingTenant()) {
        <div class="flex justify-center py-16">
          <span class="loading loading-spinner loading-md"></span>
        </div>
      } @else if (!tenant()) {
        <div class="alert alert-error mt-4">No se encontró el tenant.</div>
      } @else {
        <div class="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 class="text-2xl font-bold text-base-content">{{ tenant()!.name }}</h1>
            <div class="flex gap-2 items-center mt-1">
              <span class="badge badge-sm" [class]="statusBadge(tenant()!.status)">
                {{ tenant()!.status }}
              </span>
              @if (tenant()!.plan) {
                <span class="text-xs text-base-content/50">{{ tenant()!.plan!.name }}</span>
              }
            </div>
          </div>
        </div>

        <div role="tablist" class="tabs tabs-border mb-6">
          @for (tab of tabs; track tab.id) {
            <a
              role="tab"
              class="tab"
              [class.tab-active]="activeTab() === tab.id"
              (click)="onTabChange(tab.id)">
              <i [class]="tab.icon + ' mr-1.5'"></i>{{ tab.label }}
            </a>
          }
        </div>

        @if (activeTab() === 'overview') {
          <app-tenant-overview
            [tenant]="tenant()!"
            [tenantId]="id"
            (tenantUpdated)="tenant.set($event)" />
        }
        @if (activeTab() === 'portals') {
          <app-tenant-portals [tenantId]="id" />
        }
        @if (activeTab() === 'users') {
          <app-tenant-users [tenantId]="id" />
        }
      }
    </div>
  `,
})
export class TenantDetailComponent implements OnInit {
  @Input() id!: string

  private admin = inject(AdminService)

  tenant = signal<Tenant | null>(null)
  loadingTenant = signal(true)
  activeTab = signal<Tab>('overview')

  tabs = [
    { id: 'overview' as Tab, label: 'General', icon: 'bi bi-info-circle' },
    { id: 'portals' as Tab, label: 'Portales', icon: 'bi bi-layout-three-columns' },
    { id: 'users' as Tab, label: 'Usuarios', icon: 'bi bi-people' },
  ]

  ngOnInit() {
    this.loadTenant()
  }

  onTabChange(tab: Tab) {
    this.activeTab.set(tab)
  }

  statusBadge(status: string) {
    return STATUS_BADGE[status] ?? 'badge-ghost'
  }

  private loadTenant() {
    this.loadingTenant.set(true)
    this.admin.getTenant(this.id).subscribe({
      next: res => {
        this.tenant.set(res.data)
        this.loadingTenant.set(false)
      },
      error: () => this.loadingTenant.set(false),
    })
  }
}
