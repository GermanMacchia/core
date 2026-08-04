import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnInit,
  Output,
  signal,
  SimpleChanges,
} from '@angular/core'
import { FormBuilder, ReactiveFormsModule } from '@angular/forms'
import type { InfoCardData } from '@germanmacchia/angular-ui'
import { InfoCard, ToastService } from '@germanmacchia/angular-ui'
import type { ConfigDefinition, Tenant } from '../../../core/models/tenant.model'
import { AdminService } from '../../../core/services/admin.service'
import { ConfigEditorComponent } from '../../../shared/config-editor.component'
import { buildConfigFromValues, defaultConfigValues, existingConfigToValues } from '../../../shared/config-fields'

const STATUS_BADGE: Record<string, string> = {
  active: 'badge-success',
  trial: 'badge-warning',
  suspended: 'badge-error',
  cancelled: 'badge-ghost',
}

@Component({
  selector: 'app-tenant-overview',
  standalone: true,
  imports: [InfoCard, ReactiveFormsModule, ConfigEditorComponent],
  template: `
    <div class="flex flex-col gap-4 max-w-xl">
      <lib-info-card [data]="cardData" />
      <div class="flex justify-end">
        <button class="btn btn-primary btn-sm" (click)="openEdit()">
          <i class="bi bi-pencil"></i> Editar
        </button>
      </div>
    </div>

    <!-- Edit Modal -->
    <dialog class="modal" [class.modal-open]="showEdit()">
      <div class="modal-box w-11/12 max-w-lg flex flex-col p-0 max-h-[90vh]">
        <div class="px-6 py-4 border-b border-base-200">
          <h3 class="font-semibold text-lg">Editar tenant</h3>
        </div>
        <form [formGroup]="editForm" class="flex flex-col overflow-hidden">
          <div class="px-6 py-5 flex-1 overflow-y-auto">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <label class="form-control md:col-span-2">
                <div class="label pt-0 pb-1"><span class="label-text text-sm font-medium">Nombre</span></div>
                <input formControlName="name" type="text" class="input input-bordered" placeholder="Nombre del tenant">
              </label>
              <label class="form-control md:col-span-2">
                <div class="label pt-0 pb-1"><span class="label-text text-sm font-medium">Dominio</span></div>
                <input formControlName="domain" type="text" class="input input-bordered" placeholder="acme.example.com">
              </label>
              <label class="form-control">
                <div class="label pt-0 pb-1"><span class="label-text text-sm font-medium">Estado</span></div>
                <select formControlName="status" class="select select-bordered">
                  <option value="active">Activo</option>
                  <option value="trial">Trial</option>
                  <option value="suspended">Suspendido</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </label>
            </div>
            <app-config-editor
              [defs]="configDefs()"
              [value]="editConfigValues()"
              (valueChange)="editConfigValues.set($event)" />
          </div>
          <div class="px-6 py-4 border-t border-base-200 flex justify-end gap-2">
            <button type="button" class="btn btn-ghost btn-sm" (click)="showEdit.set(false)">Cancelar</button>
            <button type="button" class="btn btn-primary btn-sm" (click)="onUpdate()">Guardar</button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop" (click)="showEdit.set(false)"><button>close</button></form>
    </dialog>
  `,
})
export class TenantOverviewComponent implements OnInit, OnChanges {
  @Input() tenant!: Tenant
  @Input() tenantId!: string
  @Output() tenantUpdated = new EventEmitter<Tenant>()

  private admin = inject(AdminService)
  private fb = inject(FormBuilder)
  private toast = inject(ToastService)

  showEdit = signal(false)
  configDefs = signal<ConfigDefinition[]>([])
  editConfigValues = signal<Record<string, string>>({})

  editForm = this.fb.group({
    name: [''],
    domain: [''],
    status: ['active'],
  })

  get cardData(): InfoCardData {
    const t = this.tenant
    if (!t) return { title: '', sections: [] }
    return {
      title: t.name,
      titleIcon: 'bi bi-building',
      layout: 'grid',
      gridCols: 2,
      sections: [
        { name: 'Estado', content: t.status, type: 'badge', contentClass: this.statusBadge(t.status), icon: 'bi bi-circle' },
        { name: 'Dominio', content: t.domain ?? '—', icon: 'bi bi-globe' },
        { name: 'Plan', content: t.plan?.name ?? '—', icon: 'bi bi-credit-card' },
        { name: 'Precio', content: t.plan ? `$${t.plan.price}` : '—', icon: 'bi bi-cash' },
        { name: 'Creado', content: this.fmtDate(t.created_at), icon: 'bi bi-calendar' },
        { name: 'Actualizado', content: this.fmtDate(t.updated_at), icon: 'bi bi-clock' },
      ],
    }
  }

  ngOnInit() {
    this.admin.listConfigDefinitions().subscribe({
      next: res => {
        const defs = (res.data ?? []).filter(d => d.scope === 'tenant')
        this.configDefs.set(defs)
        this.editConfigValues.set(defaultConfigValues(defs))
      },
    })
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['tenant'] && this.tenant) {
      this.editForm.patchValue({
        name: this.tenant.name,
        domain: this.tenant.domain ?? '',
        status: this.tenant.status,
      })
    }
  }

  openEdit() {
    this.editForm.patchValue({
      name: this.tenant.name,
      domain: this.tenant.domain ?? '',
      status: this.tenant.status,
    })
    this.editConfigValues.set(existingConfigToValues(this.tenant.config ?? {}, this.configDefs()))
    this.showEdit.set(true)
  }

  onUpdate() {
    const v = this.editForm.getRawValue()
    const body: { name?: string; domain?: string; status?: string; config?: Record<string, unknown> } = {}
    if (v.name) body.name = v.name
    if (v.domain !== undefined) body.domain = v.domain || undefined
    if (v.status) body.status = v.status
    body.config = buildConfigFromValues(this.editConfigValues(), this.configDefs())

    this.admin.updateTenant(this.tenantId, body).subscribe({
      next: res => {
        this.showEdit.set(false)
        this.toast.toast({ severity: 'success', body: 'Tenant actualizado.' })
        this.tenantUpdated.emit(res.data)
      },
      error: err => {
        this.toast.toast({ severity: 'error', body: err.error?.error ?? 'Error al actualizar.' })
      },
    })
  }

  private statusBadge(status: string) {
    return STATUS_BADGE[status] ?? 'badge-ghost'
  }

  private fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
  }
}
