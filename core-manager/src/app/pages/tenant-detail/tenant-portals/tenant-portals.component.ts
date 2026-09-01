import { Component, computed, inject, Input, OnInit, signal } from '@angular/core'
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms'
import type { CompactListAction, CompactListColumn, FormField } from '@germanmacchia/angular-ui'
import {
  CompactList,
  CompactListCellDirective,
  Form,
  InfoModalService,
  ToastService,
} from '@germanmacchia/angular-ui'
import type { ConfigDefinition, Portal, PortalService, Service } from '../../../core/models/tenant.model'
import { AdminService } from '../../../core/services/admin.service'
import { ConfigEditorComponent } from '../../../shared/config-editor.component'
import { buildConfigFromValues, defaultConfigValues, existingConfigToValues } from '../../../shared/config-fields'

@Component({
  selector: 'app-tenant-portals',
  standalone: true,
  imports: [CompactList, CompactListCellDirective, Form, ReactiveFormsModule, ConfigEditorComponent],
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
        <ng-template compactListCell="id" let-item>
          <button
            class="text-xs text-base-content/60 hover:text-base-content flex items-center gap-1 cursor-pointer"
            title="Copiar ID"
            (click)="copyId(item.id)">
            {{ item.id }}
            <i class="bi bi-clipboard"></i>
          </button>
        </ng-template>
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
          <code class="text-xs bg-base-200 px-2 py-0.5 rounded">{{ selectedPortal()!.domain }}</code>
        }
        <button
          class="text-xs text-base-content/40 hover:text-base-content flex items-center gap-1 cursor-pointer"
          title="Copiar ID"
          (click)="copyId(selectedPortal()!.id)">
          <i class="bi bi-hash"></i>{{ selectedPortal()!.id }}
          <i class="bi bi-clipboard"></i>
        </button>
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

    <!-- Create Portal Modal -->
    <dialog class="modal" [class.modal-open]="showCreatePortal()">
      <div class="modal-box w-11/12 max-w-lg flex flex-col p-0 max-h-[90vh]">
        <div class="px-6 py-4 border-b border-base-200">
          <h3 class="font-semibold text-lg">Nuevo portal</h3>
        </div>
        <form [formGroup]="createPortalForm" class="flex flex-col overflow-hidden">
          <div class="px-6 py-5 flex-1 overflow-y-auto">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <label class="form-control md:col-span-2">
                <div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Nombre <span class="text-error text-xs">*</span></span></div>
                <input formControlName="name" type="text" class="input input-bordered" placeholder="Admin Portal">
              </label>
              <label class="form-control md:col-span-2">
                <div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Dominio</span></div>
                <input formControlName="domain" type="text" class="input input-bordered" placeholder="admin.acme.com">
              </label>
              <label class="form-control md:col-span-2">
                <div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Descripción</span></div>
                <input formControlName="description" type="text" class="input input-bordered" placeholder="Portal de administración">
              </label>
            </div>
            <app-config-editor
              [defs]="portalConfigDefs()"
              [value]="createConfigValues()"
              (valueChange)="createConfigValues.set($event)" />
          </div>
          <div class="px-6 py-4 border-t border-base-200 flex justify-end gap-2">
            <button type="button" class="btn btn-ghost btn-sm" (click)="showCreatePortal.set(false)">Cancelar</button>
            <button type="button" class="btn btn-primary btn-sm" (click)="onCreatePortal()">Crear</button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop" (click)="showCreatePortal.set(false)"><button>close</button></form>
    </dialog>

    <!-- Edit Portal Modal -->
    <dialog class="modal" [class.modal-open]="showEditPortal()">
      <div class="modal-box w-11/12 max-w-lg flex flex-col p-0 max-h-[90vh]">
        <div class="px-6 py-4 border-b border-base-200">
          <h3 class="font-semibold text-lg">Editar portal</h3>
        </div>
        <form [formGroup]="editPortalForm" class="flex flex-col overflow-hidden">
          <div class="px-6 py-5 flex-1 overflow-y-auto">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <label class="form-control md:col-span-2">
                <div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Nombre <span class="text-error text-xs">*</span></span></div>
                <input formControlName="name" type="text" class="input input-bordered" placeholder="Admin Portal">
              </label>
              <label class="form-control md:col-span-2">
                <div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Dominio</span></div>
                <input formControlName="domain" type="text" class="input input-bordered" placeholder="admin.acme.com">
              </label>
              <label class="form-control md:col-span-2">
                <div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Descripción</span></div>
                <input formControlName="description" type="text" class="input input-bordered" placeholder="Portal de administración">
              </label>
              <label class="form-control md:col-span-2">
                <div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Estado</span></div>
                <select formControlName="is_active" class="select select-bordered">
                  <option [ngValue]="true">Activo</option>
                  <option [ngValue]="false">Inactivo</option>
                </select>
              </label>
            </div>
            <app-config-editor
              [defs]="portalConfigDefs()"
              [value]="editConfigValues()"
              (valueChange)="editConfigValues.set($event)" />
          </div>
          <div class="px-6 py-4 border-t border-base-200 flex justify-end gap-2">
            <button type="button" class="btn btn-ghost btn-sm" (click)="showEditPortal.set(false)">Cancelar</button>
            <button type="button" class="btn btn-primary btn-sm" (click)="onUpdatePortal()">Guardar</button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop" (click)="showEditPortal.set(false)"><button>close</button></form>
    </dialog>

    <!-- Assign Service Modal (sin config, usa lib-form) -->
    <lib-form
      [formGroup]="assignServiceForm"
      [fields]="assignServiceFields()"
      [displayMode]="'modal'"
      [title]="'Asignar servicio'"
      [isOpen]="showAssignService()"
      (submitEvent)="onAssignService()"
      (cancelEvent)="showAssignService.set(false)" />

    <!-- Edit Assigned Service Modal -->
    <dialog class="modal" [class.modal-open]="showEditService()">
      <div class="modal-box w-11/12 max-w-lg flex flex-col p-0 max-h-[90vh]">
        <div class="px-6 py-4 border-b border-base-200">
          <h3 class="font-semibold text-lg">Editar servicio asignado</h3>
        </div>
        <form [formGroup]="editServiceForm" class="flex flex-col overflow-hidden">
          <div class="px-6 py-5 flex-1 overflow-y-auto">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <label class="form-control md:col-span-2">
                <div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Slug de montaje <span class="text-error text-xs">*</span></span></div>
                <input formControlName="slug" type="text" class="input input-bordered" placeholder="/manager">
              </label>
              <label class="form-control md:col-span-2">
                <div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Orden</span></div>
                <input formControlName="sort_order" type="number" class="input input-bordered" placeholder="0">
              </label>
            </div>
            <app-config-editor
              [defs]="serviceConfigDefs()"
              [value]="editServiceConfigValues()"
              (valueChange)="editServiceConfigValues.set($event)" />
          </div>
          <div class="px-6 py-4 border-t border-base-200 flex justify-end gap-2">
            <button type="button" class="btn btn-ghost btn-sm" (click)="showEditService.set(false)">Cancelar</button>
            <button type="button" class="btn btn-primary btn-sm" (click)="onUpdateService()">Guardar</button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop" (click)="showEditService.set(false)"><button>close</button></form>
    </dialog>
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
  showEditService = signal(false)
  private editPortalTarget: Portal | null = null
  editServiceTarget: PortalService | null = null

  catalog = signal<Service[]>([])
  portalConfigDefs = signal<ConfigDefinition[]>([])
  serviceConfigDefs = signal<ConfigDefinition[]>([])
  createConfigValues = signal<Record<string, string>>({})
  editConfigValues = signal<Record<string, string>>({})
  editServiceConfigValues = signal<Record<string, string>>({})

  createPortalForm = this.fb.group({
    name: ['', Validators.required],
    domain: [''],
    description: [''],
  })

  editPortalForm = this.fb.group({
    name: [''],
    domain: [''],
    description: [''],
    is_active: [true],
  })

  assignServiceForm = this.fb.group({
    service_id: ['', Validators.required],
    slug: ['', Validators.required],
    sort_order: [0],
  })

  editServiceForm = this.fb.group({
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
    { name: 'slug', label: 'Slug de montaje', type: 'text', required: true, placeholder: '/manager' },
    { name: 'sort_order', label: 'Orden', type: 'text', placeholder: '0' },
  ])

  portalColumns: CompactListColumn<Portal>[] = [
    { key: 'id', header: 'ID', type: 'custom' },
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
    { id: 'edit', icon: 'bi bi-pencil', tooltip: 'Editar' },
    { id: 'unassign', icon: 'bi bi-x-circle', tooltip: 'Desasignar', class: 'text-error' },
  ]

  copyId(id: string) {
    navigator.clipboard.writeText(id).then(
      () => this.toast.toast({ severity: 'info', body: 'ID copiado al portapapeles.' }),
      () => this.toast.toast({ severity: 'error', body: 'No se pudo copiar el ID.' }),
    )
  }

  ngOnInit() {
    this.loadPortals()
    this.loadCatalog()
    this.loadConfigDefs()
  }

  loadConfigDefs() {
    this.admin.listConfigDefinitions().subscribe({
      next: res => {
        const all = res.data ?? []
        const portalDefs = all.filter(d => d.scope === 'portal')
        this.portalConfigDefs.set(portalDefs)
        this.createConfigValues.set(defaultConfigValues(portalDefs))
        this.editConfigValues.set(defaultConfigValues(portalDefs))

        const serviceDefs = all.filter(d => d.scope === 'service')
        this.serviceConfigDefs.set(serviceDefs)
        this.editServiceConfigValues.set(defaultConfigValues(serviceDefs))
      },
    })
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
      this.editConfigValues.set(existingConfigToValues(event.item.config ?? {}, this.portalConfigDefs()))
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
    const body: { name?: string; domain?: string; description?: string; is_active?: boolean; config?: Record<string, unknown> } = { name: v.name }
    if (v.domain !== undefined) body.domain = v.domain || undefined
    if (v.description !== undefined) body.description = v.description || undefined
    body.is_active = v.is_active === true
    body.config = buildConfigFromValues(this.editConfigValues(), this.portalConfigDefs())

    this.admin.updatePortal(this.editPortalTarget.id, body).subscribe({
      next: res => {
        this.portals.update(list => list.map(p => (p.id === res.data.id ? res.data : p)))
        this.showEditPortal.set(false)
        this.editPortalTarget = null
        this.toast.toast({ severity: 'success', body: `Portal "${res.data.name}" actualizado.` })
      },
      error: err => {
        this.toast.toast({ severity: 'error', body: err.error?.error ?? 'Error al actualizar el portal.' })
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
    const body: { name: string; domain?: string; description?: string; config?: Record<string, unknown> } = { name: v.name! }
    if (v.domain) body.domain = v.domain
    if (v.description) body.description = v.description
    body.config = buildConfigFromValues(this.createConfigValues(), this.portalConfigDefs())

    this.admin.createPortal(this.tenantId, body).subscribe({
      next: res => {
        this.portals.update(list => [...list, res.data])
        this.showCreatePortal.set(false)
        this.createPortalForm.reset()
        this.createConfigValues.set(defaultConfigValues(this.portalConfigDefs()))
        this.toast.toast({ severity: 'success', body: `Portal "${res.data.name}" creado.` })
      },
      error: err => {
        this.toast.toast({ severity: 'error', body: err.error?.error ?? 'Error al crear el portal.' })
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
    this.admin.assignPortalService(portal.id, {
      service_id: v.service_id!,
      slug: v.slug!,
      sort_order: Number(v.sort_order ?? 0),
    }).subscribe({
      next: res => {
        this.portalServices.update(list => {
          const idx = list.findIndex(s => s.id === res.data.id)
          return idx >= 0 ? list.map((s, i) => (i === idx ? res.data : s)) : [...list, res.data]
        })
        this.showAssignService.set(false)
        this.toast.toast({ severity: 'success', body: 'Servicio asignado.' })
      },
      error: err => {
        this.toast.toast({ severity: 'error', body: err.error?.error ?? 'Error al asignar el servicio.' })
      },
    })
  }

  onPortalServiceAction(event: { action: string; item: PortalService }) {
    if (event.action === 'edit') {
      this.editServiceTarget = event.item
      this.editServiceForm.patchValue({
        slug: event.item.slug,
        sort_order: event.item.sort_order,
      })
      this.editServiceConfigValues.set(existingConfigToValues(event.item.config ?? {}, this.serviceConfigDefs()))
      this.showEditService.set(true)
    } else if (event.action === 'unassign') {
      const portal = this.selectedPortal()
      if (!portal) return
      this.infoModal.openAsConfirm(
        () => this.doUnassignService(portal.id, event.item),
        `¿Desasignar "${event.item.name}" del portal?`,
      )
    }
  }

  onUpdateService() {
    const portal = this.selectedPortal()
    const target = this.editServiceTarget
    if (!portal || !target || this.editServiceForm.invalid) return
    const v = this.editServiceForm.getRawValue()
    const configOverride = buildConfigFromValues(this.editServiceConfigValues(), this.serviceConfigDefs())

    this.admin.updatePortalService(portal.id, target.id, {
      slug: v.slug!,
      sort_order: Number(v.sort_order ?? 0),
      config_override: configOverride,
    }).subscribe({
      next: res => {
        this.portalServices.update(list => list.map(s => (s.id === res.data.id ? res.data : s)))
        this.showEditService.set(false)
        this.editServiceTarget = null
        this.toast.toast({ severity: 'success', body: 'Servicio asignado actualizado.' })
      },
      error: err => {
        this.toast.toast({ severity: 'error', body: err.error?.error ?? 'Error al actualizar el servicio asignado.' })
      },
    })
  }

  private loadPortals() {
    this.loadingPortals.set(true)
    this.admin.listPortals(this.tenantId).subscribe({
      next: res => { this.portals.set(res.data ?? []); this.loadingPortals.set(false) },
      error: () => this.loadingPortals.set(false),
    })
  }

  private loadCatalog() {
    this.admin.listServices(true).subscribe({ next: res => this.catalog.set(res.data ?? []) })
  }

  private loadPortalServices(portalId: string) {
    this.loadingPortalServices.set(true)
    this.admin.getPortalServices(portalId).subscribe({
      next: res => { this.portalServices.set(res.data ?? []); this.loadingPortalServices.set(false) },
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
