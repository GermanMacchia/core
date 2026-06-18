import { Component, computed, inject, Input, OnInit, signal } from '@angular/core'
import { FormBuilder, Validators } from '@angular/forms'
import type { CompactListAction, CompactListColumn, FormField } from '@germanmacchia/angular-ui'
import {
  CompactList,
  CompactListCellDirective,
  Form,
  InfoModalService,
  ToastService,
} from '@germanmacchia/angular-ui'
import type { Portal, PortalService, Service } from '../../../core/models/tenant.model'
import { AdminService } from '../../../core/services/admin.service'

@Component({
  selector: 'app-tenant-portals',
  standalone: true,
  imports: [CompactList, CompactListCellDirective, Form],
  template: `
    @if (!selectedPortal()) {
      <div class="flex justify-end mb-4">
        <button class="btn btn-primary btn-sm" (click)="showCreatePortal.set(true)">
          <i class="bi bi-plus-lg"></i> Nuevo portal
        </button>
      </div>
      <lib-compact-list
        [items]="portals()"
        [columns]="portalColumns"
        [actions]="portalActions"
        [loading]="loadingPortals()"
        [emptyIcon]="'bi bi-layout-three-columns'"
        [emptyMessage]="'Sin portales'"
        [trackByKey]="'id'"
        [booleanTrueLabel]="'Activo'"
        [booleanFalseLabel]="'Inactivo'"
        (actionClick)="onPortalAction($event)">
        <ng-template compactListCell="domain" let-item>
          <span class="text-xs text-base-content/60">{{ item.domain ?? '—' }}</span>
        </ng-template>
      </lib-compact-list>
    } @else {
      <div class="flex items-center gap-3 mb-4">
        <button class="btn btn-ghost btn-sm" (click)="onBackToPortals()">
          <i class="bi bi-arrow-left"></i> Portales
        </button>
        <span class="text-base font-semibold">{{ selectedPortal()!.name }}</span>
        @if (selectedPortal()!.domain) {
          <code class="text-xs bg-base-200 px-2 py-0.5 rounded">
            {{ selectedPortal()!.domain }}
          </code>
        }
      </div>
      <div class="flex justify-end mb-4">
        <button class="btn btn-primary btn-sm" (click)="openAssignService()">
          <i class="bi bi-plus-lg"></i> Asignar servicio
        </button>
      </div>
      <lib-compact-list
        [items]="portalServices()"
        [columns]="portalServiceColumns"
        [actions]="portalServiceActions"
        [loading]="loadingPortalServices()"
        [emptyIcon]="'bi bi-grid'"
        [emptyMessage]="'Sin servicios asignados'"
        [trackByKey]="'id'"
        (actionClick)="onPortalServiceAction($event)">
      </lib-compact-list>
    }

    <lib-form
      [formGroup]="createPortalForm"
      [fields]="createPortalFields"
      [displayMode]="'modal'"
      [title]="'Nuevo portal'"
      [isOpen]="showCreatePortal()"
      (submitEvent)="onCreatePortal()"
      (cancelEvent)="showCreatePortal.set(false)" />

    <lib-form
      [formGroup]="editPortalForm"
      [fields]="editPortalFields"
      [displayMode]="'modal'"
      [title]="'Editar portal'"
      [isOpen]="showEditPortal()"
      (submitEvent)="onUpdatePortal()"
      (cancelEvent)="showEditPortal.set(false)" />

    <lib-form
      [formGroup]="assignServiceForm"
      [fields]="assignServiceFields()"
      [displayMode]="'modal'"
      [title]="'Asignar servicio'"
      [isOpen]="showAssignService()"
      (submitEvent)="onAssignService()"
      (cancelEvent)="showAssignService.set(false)" />
  `,
})
export class TenantPortalsComponent implements OnInit {
  @Input() tenantId!: string

  private admin = inject(AdminService)
  private fb = inject(FormBuilder)
  private toast = inject(ToastService)
  private infoModal = inject(InfoModalService)

  portals = signal<Portal[]>([])
  loadingPortals = signal(false)
  selectedPortal = signal<Portal | null>(null)

  portalServices = signal<PortalService[]>([])
  loadingPortalServices = signal(false)

  showCreatePortal = signal(false)
  showEditPortal = signal(false)
  showAssignService = signal(false)
  private editPortalTarget: Portal | null = null

  catalog = signal<Service[]>([])

  createPortalForm = this.fb.group({
    name: ['', Validators.required],
    domain: [''],
    description: [''],
  })

  createPortalFields: FormField[] = [
    { name: 'name', label: 'Nombre', type: 'text', required: true, placeholder: 'Admin Portal' },
    { name: 'domain', label: 'Dominio', type: 'text', placeholder: 'admin.acme.com' },
    {
      name: 'description',
      label: 'Descripción',
      type: 'text',
      placeholder: 'Portal de administración',
    },
  ]

  editPortalForm = this.fb.group({
    name: [''],
    domain: [''],
    description: [''],
    is_active: [true],
  })

  editPortalFields: FormField[] = [
    { name: 'name', label: 'Nombre', type: 'text', required: true, placeholder: 'Admin Portal' },
    { name: 'domain', label: 'Dominio', type: 'text', placeholder: 'admin.acme.com' },
    {
      name: 'description',
      label: 'Descripción',
      type: 'text',
      placeholder: 'Portal de administración',
    },
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

  assignServiceForm = this.fb.group({
    service_id: ['', Validators.required],
    slug: ['', Validators.required],
    sort_order: [0],
  })

  assignServiceFields = computed<FormField[]>(() => [
    {
      name: 'service_id',
      label: 'Servicio',
      type: 'select',
      required: true,
      options: this.catalog().map(s => ({ label: s.name, value: s.id })),
    },
    {
      name: 'slug',
      label: 'Slug de montaje',
      type: 'text',
      required: true,
      placeholder: '/manager',
    },
    { name: 'sort_order', label: 'Orden', type: 'text', placeholder: '0' },
  ])

  portalColumns: CompactListColumn<Portal>[] = [
    { key: 'name', prop: 'name', header: 'Nombre', type: 'text' },
    { key: 'domain', header: 'Dominio', type: 'custom' },
    { key: 'description', prop: 'description', header: 'Descripción', type: 'text' },
    { key: 'is_active', prop: 'is_active', header: 'Activo', type: 'boolean' },
  ]

  portalActions: CompactListAction<Portal>[] = [
    { id: 'edit', icon: 'bi bi-pencil', tooltip: 'Editar' },
    { id: 'services', icon: 'bi bi-grid', tooltip: 'Servicios' },
  ]

  portalServiceColumns: CompactListColumn<PortalService>[] = [
    { key: 'name', prop: 'name', header: 'Servicio', type: 'text' },
    { key: 'slug', prop: 'slug', header: 'Slug', type: 'text' },
    { key: 'sort_order', prop: 'sort_order', header: 'Orden', type: 'text' },
    { key: 'mfe_url', prop: 'mfe_url', header: 'MFE URL', type: 'text' },
  ]

  portalServiceActions: CompactListAction<PortalService>[] = [
    { id: 'unassign', icon: 'bi bi-x-circle', tooltip: 'Desasignar', class: 'text-error' },
  ]

  ngOnInit() {
    this.loadPortals()
    this.loadCatalog()
  }

  onPortalAction(event: { action: string; item: Portal }) {
    if (event.action === 'edit') {
      this.editPortalTarget = event.item
      this.editPortalForm.patchValue({
        name: event.item.name,
        domain: event.item.domain ?? '',
        description: event.item.description ?? '',
        is_active: event.item.is_active,
      })
      this.showEditPortal.set(true)
    } else if (event.action === 'services') {
      this.selectedPortal.set(event.item)
      this.loadPortalServices(event.item.id)
    }
  }

  onUpdatePortal() {
    const v = this.editPortalForm.getRawValue()
    if (!this.editPortalTarget || !v.name) {
      this.toast.toast({ severity: 'warning', body: 'El nombre es requerido.' })
      return
    }
    const body: {
      name?: string
      domain?: string
      description?: string
      is_active?: boolean
    } = { name: v.name }
    if (v.domain !== undefined) body.domain = v.domain || undefined
    if (v.description !== undefined) body.description = v.description || undefined
    body.is_active = v.is_active === true

    this.admin.updatePortal(this.editPortalTarget.id, body).subscribe({
      next: res => {
        this.portals.update(list => list.map(p => (p.id === res.data.id ? res.data : p)))
        this.showEditPortal.set(false)
        this.editPortalTarget = null
        this.toast.toast({ severity: 'success', body: `Portal "${res.data.name}" actualizado.` })
      },
      error: err => {
        this.toast.toast({
          severity: 'error',
          body: err.error?.error ?? 'Error al actualizar el portal.',
        })
      },
    })
  }

  onBackToPortals() {
    this.selectedPortal.set(null)
    this.portalServices.set([])
  }

  onCreatePortal() {
    if (this.createPortalForm.invalid) {
      this.toast.toast({ severity: 'warning', body: 'El nombre es requerido.' })
      return
    }
    const v = this.createPortalForm.getRawValue()
    const body: { name: string; domain?: string; description?: string } = { name: v.name! }
    if (v.domain) body.domain = v.domain
    if (v.description) body.description = v.description

    this.admin.createPortal(this.tenantId, body).subscribe({
      next: res => {
        this.portals.update(list => [...list, res.data])
        this.showCreatePortal.set(false)
        this.createPortalForm.reset()
        this.toast.toast({ severity: 'success', body: `Portal "${res.data.name}" creado.` })
      },
      error: err => {
        this.toast.toast({
          severity: 'error',
          body: err.error?.error ?? 'Error al crear el portal.',
        })
      },
    })
  }

  openAssignService() {
    this.assignServiceForm.reset({ sort_order: 0 })
    this.showAssignService.set(true)
  }

  onAssignService() {
    const portal = this.selectedPortal()
    if (!portal || this.assignServiceForm.invalid) return

    const v = this.assignServiceForm.getRawValue()
    this.admin
      .assignPortalService(portal.id, {
        service_id: v.service_id!,
        slug: v.slug!,
        sort_order: Number(v.sort_order ?? 0),
      })
      .subscribe({
        next: res => {
          this.portalServices.update(list => {
            const idx = list.findIndex(s => s.id === res.data.id)
            return idx >= 0
              ? list.map((s, i) => (i === idx ? res.data : s))
              : [...list, res.data]
          })
          this.showAssignService.set(false)
          this.toast.toast({ severity: 'success', body: 'Servicio asignado.' })
        },
        error: err => {
          this.toast.toast({
            severity: 'error',
            body: err.error?.error ?? 'Error al asignar el servicio.',
          })
        },
      })
  }

  onPortalServiceAction(event: { action: string; item: PortalService }) {
    if (event.action === 'unassign') {
      const portal = this.selectedPortal()
      if (!portal) return
      this.infoModal.openAsConfirm(
        () => this.doUnassignService(portal.id, event.item),
        `¿Desasignar "${event.item.name}" del portal?`,
      )
    }
  }

  private loadPortals() {
    this.loadingPortals.set(true)
    this.admin.listPortals(this.tenantId).subscribe({
      next: res => {
        this.portals.set(res.data ?? [])
        this.loadingPortals.set(false)
      },
      error: () => this.loadingPortals.set(false),
    })
  }

  private loadCatalog() {
    this.admin.listServices(true).subscribe({
      next: res => this.catalog.set(res.data ?? []),
    })
  }

  private loadPortalServices(portalId: string) {
    this.loadingPortalServices.set(true)
    this.admin.getPortalServices(portalId).subscribe({
      next: res => {
        this.portalServices.set(res.data ?? [])
        this.loadingPortalServices.set(false)
      },
      error: () => this.loadingPortalServices.set(false),
    })
  }

  private doUnassignService(portalId: string, svc: PortalService) {
    this.admin.unassignPortalService(portalId, svc.id).subscribe({
      next: () => {
        this.portalServices.update(list => list.filter(s => s.id !== svc.id))
        this.toast.toast({ severity: 'success', body: `"${svc.name}" desasignado.` })
      },
      error: () => {
        this.toast.toast({ severity: 'error', body: 'Error al desasignar el servicio.' })
      },
    })
  }
}
