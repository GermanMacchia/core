import { Component, computed, inject, input, type OnInit, signal } from '@angular/core'
import type { HttpErrorResponse } from '@angular/common/http'
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
import { apiErrorMessage } from '../../../core/utils/api-error'

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
  readonly tenantId = input.required<string>()

  private admin = inject(AdminService)
  private fb = inject(FormBuilder)
  private toast = inject(ToastService)
  private infoModal = inject(InfoModalService)

  services = signal<TenantService[]>([])
  loadingServices = signal(false)
  // lib-form exposes no disabled/loading input, so this guards the submit
  // handlers against double submission instead of disabling the button.
  saving = signal(false)
  showAssignService = signal(false)
  showEditInstance = signal(false)
  catalog = signal<Service[]>([])
  private editInstanceTarget: TenantService | null = null

  assignServiceForm = this.fb.nonNullable.group({
    service_id: ['', Validators.required],
  })

  editInstanceForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    // Mirrors slugutil.Valid in core-backend.
    slug: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(/^[a-z0-9]+(-[a-z0-9]+)*$/)]],
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
    { name: 'slug', label: 'Slug (URL pública)', type: 'text', required: true, placeholder: 'mi-negocio' },
    { name: 'logo_url', label: 'Logo (URL)', type: 'text', placeholder: 'https://...' },
  ]

  serviceColumns: CompactListColumn<TenantService>[] = [
    { key: 'name', prop: 'name', header: 'Servicio', type: 'text' },
    { key: 'mfe_url', prop: 'mfe_url', header: 'MFE URL', type: 'text' },
    { key: 'instance', header: 'Negocio', type: 'text', transform: s => s.instance?.name ?? '—' },
    { key: 'slug', header: 'Slug', type: 'text', transform: s => s.instance?.slug ?? '—' },
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
    if (this.assignServiceForm.invalid || this.saving()) return
    const v = this.assignServiceForm.getRawValue()
    this.saving.set(true)
    this.admin.assignTenantService(this.tenantId(), { service_id: v.service_id }).subscribe({
      next: res => {
        this.saving.set(false)
        this.services.update(list => {
          const idx = list.findIndex(s => s.id === res.data.id)
          return idx >= 0 ? list.map((s, i) => (i === idx ? res.data : s)) : [...list, res.data]
        })
        this.showAssignService.set(false)
        this.toast.toast({ severity: 'success', body: 'Servicio asociado al tenant.' })
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false)
        this.toast.toast({ severity: 'error', body: apiErrorMessage(err, 'Error al asociar el servicio.') })
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
      const logoUrl = event.item.instance.config?.['logo_url']
      this.editInstanceForm.reset({
        name: event.item.instance.name,
        slug: event.item.instance.slug,
        logo_url: typeof logoUrl === 'string' ? logoUrl : '',
      })
      this.showEditInstance.set(true)
    }
  }

  onUpdateInstance() {
    const target = this.editInstanceTarget
    if (!target || this.editInstanceForm.invalid || this.saving()) return
    const slug = this.editInstanceForm.getRawValue().slug
    const slugChanged = slug !== target.instance?.slug

    // The slug is the business's public URL; changing it breaks every link
    // already shared, so ask before sending it.
    if (slugChanged) {
      this.infoModal.openAsConfirm(
        () => this.saveInstance(target, slug),
        `Cambiar el slug a "${slug}" rompe los links y QR que ya usen "${target.instance?.slug}". ¿Continuar?`,
      )
      return
    }
    this.saveInstance(target)
  }

  private saveInstance(target: TenantService, slug?: string) {
    const v = this.editInstanceForm.getRawValue()
    this.saving.set(true)
    // core-backend shallow-merges `config` into the existing instance config
    // (jsonb ||), so sending only logo_url keeps the other keys intact.
    this.admin.updateTenantServiceInstance(this.tenantId(), target.id, {
      name: v.name,
      slug,
      config: { logo_url: v.logo_url || undefined },
    }).subscribe({
      next: res => {
        this.saving.set(false)
        this.services.update(list =>
          list.map(s => (s.id === target.id ? { ...s, instance: res.data } : s)),
        )
        this.showEditInstance.set(false)
        this.editInstanceTarget = null
        this.toast.toast({ severity: 'success', body: 'Negocio actualizado.' })
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false)
        this.toast.toast({ severity: 'error', body: apiErrorMessage(err, 'Error al actualizar el negocio.') })
      },
    })
  }

  private loadServices() {
    this.loadingServices.set(true)
    this.admin.listTenantServices(this.tenantId()).subscribe({
      next: res => {
        this.services.set(res.data ?? [])
        this.loadingServices.set(false)
      },
      error: (err: HttpErrorResponse) => {
        this.loadingServices.set(false)
        this.toast.toast({ severity: 'error', body: apiErrorMessage(err, 'Error al cargar los servicios del tenant.') })
      },
    })
  }

  private loadCatalog() {
    this.admin.listServices(true).subscribe({
      next: res => this.catalog.set(res.data ?? []),
      error: (err: HttpErrorResponse) => {
        this.toast.toast({ severity: 'error', body: apiErrorMessage(err, 'Error al cargar el catálogo de servicios.') })
      },
    })
  }

  private doUnassign(svc: TenantService) {
    if (this.saving()) return
    this.saving.set(true)
    this.admin.unassignTenantService(this.tenantId(), svc.id).subscribe({
      next: () => {
        this.saving.set(false)
        this.services.update(list => list.filter(s => s.id !== svc.id))
        this.toast.toast({ severity: 'success', body: `Servicio "${svc.name}" desasociado.` })
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false)
        this.toast.toast({ severity: 'error', body: apiErrorMessage(err, 'Error al desasociar el servicio.') })
      },
    })
  }
}
