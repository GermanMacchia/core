import { Component, computed, inject, Input, OnInit, signal } from '@angular/core'
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms'
import type { CompactListAction, CompactListColumn, FormField } from '@germanmacchia/angular-ui'
import {
  CompactList,
  Form,
  InfoModalService,
  ToastService,
} from '@germanmacchia/angular-ui'
import type { Service, TenantService } from '../../../core/models/tenant.model'
import { AdminService } from '../../../core/services/admin.service'

@Component({
  selector: 'app-tenant-services',
  standalone: true,
  imports: [CompactList, Form, ReactiveFormsModule],
  template: `
    <div class="flex justify-end mb-4">
      <button class="btn btn-primary btn-sm" (click)="openAssignService()">
        <i class="bi bi-plus-lg"></i> Asignar servicio
      </button>
    </div>
    <lib-compact-list
      [items]="services()"
      [columns]="serviceColumns"
      [actions]="serviceActions"
      [loading]="loadingServices()"
      [emptyIcon]="'bi bi-grid'"
      [emptyMessage]="'Sin servicios asociados'"
      [trackByKey]="'id'"
      (actionClick)="onServiceAction($event)">
    </lib-compact-list>

    <lib-form
      [formGroup]="assignServiceForm"
      [fields]="assignServiceFields()"
      [displayMode]="'modal'"
      [title]="'Asignar servicio'"
      [isOpen]="showAssignService()"
      (submitEvent)="onAssignService()"
      (cancelEvent)="showAssignService.set(false)" />

    <lib-form
      [formGroup]="editInstanceForm"
      [fields]="editInstanceFields"
      [displayMode]="'modal'"
      [title]="'Editar negocio'"
      [isOpen]="showEditInstance()"
      (submitEvent)="onUpdateInstance()"
      (cancelEvent)="showEditInstance.set(false)" />
  `,
})
export class TenantServicesComponent implements OnInit {
  @Input() tenantId!: string

  private admin = inject(AdminService)
  private fb = inject(FormBuilder)
  private toast = inject(ToastService)
  private infoModal = inject(InfoModalService)

  services = signal<TenantService[]>([])
  loadingServices = signal(false)
  showAssignService = signal(false)
  showEditInstance = signal(false)
  catalog = signal<Service[]>([])
  private editInstanceTarget: TenantService | null = null

  assignServiceForm = this.fb.group({
    service_id: ['', Validators.required],
  })

  editInstanceForm = this.fb.group({
    name: ['', Validators.required],
    logo_url: [''],
  })

  assignServiceFields = computed<FormField[]>(() => [
    {
      name: 'service_id',
      label: 'Servicio',
      type: 'select',
      required: true,
      options: this.catalog().map(s => ({ label: s.name, value: s.id })),
    },
  ])

  editInstanceFields: FormField[] = [
    { name: 'name', label: 'Nombre', type: 'text', required: true },
    { name: 'logo_url', label: 'Logo (URL)', type: 'text', placeholder: 'https://...' },
  ]

  serviceColumns: CompactListColumn<TenantService>[] = [
    { key: 'name', prop: 'name', header: 'Servicio', type: 'text' },
    { key: 'mfe_url', prop: 'mfe_url', header: 'MFE URL', type: 'text' },
    { key: 'instance', header: 'Negocio', type: 'text', transform: s => s.instance?.name ?? '—' },
  ]

  serviceActions: CompactListAction<TenantService>[] = [
    { id: 'edit-instance', icon: 'bi bi-briefcase', tooltip: 'Editar negocio' },
    { id: 'unassign', icon: 'bi bi-x-circle', tooltip: 'Desasignar', class: 'text-error' },
  ]

  ngOnInit() {
    this.loadServices()
    this.loadCatalog()
  }

  openAssignService() {
    this.assignServiceForm.reset()
    this.showAssignService.set(true)
  }

  onAssignService() {
    if (this.assignServiceForm.invalid) return
    const v = this.assignServiceForm.getRawValue()
    this.admin.assignTenantService(this.tenantId, { service_id: v.service_id! }).subscribe({
      next: res => {
        this.services.update(list => {
          const idx = list.findIndex(s => s.id === res.data.id)
          return idx >= 0 ? list.map((s, i) => (i === idx ? res.data : s)) : [...list, res.data]
        })
        this.showAssignService.set(false)
        this.toast.toast({ severity: 'success', body: 'Servicio asociado al tenant.' })
      },
      error: err => {
        this.toast.toast({ severity: 'error', body: err.error?.error ?? 'Error al asociar el servicio.' })
      },
    })
  }

  onServiceAction(event: { action: string; item: TenantService }) {
    if (event.action === 'unassign') {
      this.infoModal.openAsConfirm(
        () => this.doUnassign(event.item),
        `¿Desasociar "${event.item.name}" del tenant?`,
      )
    } else if (event.action === 'edit-instance') {
      if (!event.item.requires_instance || !event.item.instance) {
        this.toast.toast({ severity: 'warning', body: 'Este servicio no tiene un negocio asociado.' })
        return
      }
      this.editInstanceTarget = event.item
      this.editInstanceForm.reset({
        name: event.item.instance.name,
        logo_url: (event.item.instance.config?.['logo_url'] as string) ?? '',
      })
      this.showEditInstance.set(true)
    }
  }

  onUpdateInstance() {
    const target = this.editInstanceTarget
    if (!target || this.editInstanceForm.invalid) return
    const v = this.editInstanceForm.getRawValue()
    this.admin.updateTenantServiceInstance(this.tenantId, target.id, {
      name: v.name!,
      config: { logo_url: v.logo_url || undefined },
    }).subscribe({
      next: res => {
        this.services.update(list =>
          list.map(s => (s.id === target.id ? { ...s, instance: res.data } : s)),
        )
        this.showEditInstance.set(false)
        this.editInstanceTarget = null
        this.toast.toast({ severity: 'success', body: 'Negocio actualizado.' })
      },
      error: err => {
        this.toast.toast({ severity: 'error', body: err.error?.error ?? 'Error al actualizar el negocio.' })
      },
    })
  }

  private loadServices() {
    this.loadingServices.set(true)
    this.admin.listTenantServices(this.tenantId).subscribe({
      next: res => {
        this.services.set(res.data ?? [])
        this.loadingServices.set(false)
      },
      error: () => this.loadingServices.set(false),
    })
  }

  private loadCatalog() {
    this.admin.listServices(true).subscribe({ next: res => this.catalog.set(res.data ?? []) })
  }

  private doUnassign(svc: TenantService) {
    this.admin.unassignTenantService(this.tenantId, svc.id).subscribe({
      next: () => {
        this.services.update(list => list.filter(s => s.id !== svc.id))
        this.toast.toast({ severity: 'success', body: `Servicio "${svc.name}" desasociado.` })
      },
      error: () => {
        this.toast.toast({ severity: 'error', body: 'Error al desasociar el servicio.' })
      },
    })
  }
}
