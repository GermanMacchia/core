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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms'
import type { InfoCardData } from '@germanmacchia/angular-ui'
import { InfoCard, ToastService } from '@germanmacchia/angular-ui'
import type { ConfigDefinition, Tenant, UpdateTenantInput } from '../../../core/models/tenant.model'
import { AdminService } from '../../../core/services/admin.service'
import { ConfigEditorComponent } from '../../../shared/config-editor.component'
import { buildConfigFromValues, defaultConfigValues, existingConfigToValues } from '../../../shared/config-fields'
import { ADDRESS_MAX_LENGTH, CUIT_PATTERN, formatCuit, orDash, PHONE_PATTERN } from '../../../shared/tenant-contact'

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
                <div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Nombre</span></div>
                <input formControlName="name" type="text" class="input input-bordered" placeholder="Nombre del tenant">
              </label>
              <label class="form-control">
                <div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Email de contacto</span></div>
                <input formControlName="contact_email" type="email" class="input input-bordered" placeholder="admin@acme.com">
                @if (invalid('contact_email')) {
                  <span class="text-error text-xs mt-1">Ingresá un email válido.</span>
                }
              </label>
              <label class="form-control">
                <div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Teléfono de contacto</span></div>
                <input formControlName="contact_phone" type="text" class="input input-bordered" placeholder="+54 11 4555-1234">
                @if (invalid('contact_phone')) {
                  <span class="text-error text-xs mt-1">Usá solo dígitos, espacios, guiones, paréntesis y un + inicial (mínimo 6 dígitos).</span>
                }
              </label>
              <label class="form-control">
                <div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">CUIT/CUIL</span></div>
                <input formControlName="tax_id" type="text" class="input input-bordered" placeholder="20-12345678-9">
                @if (invalid('tax_id')) {
                  <span class="text-error text-xs mt-1">Ingresá 11 dígitos, con o sin guiones.</span>
                }
              </label>
              <label class="form-control md:col-span-2">
                <div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Dirección</span></div>
                <textarea formControlName="address" class="textarea textarea-bordered" rows="2" placeholder="Av. Corrientes 1234, CABA"></textarea>
                @if (invalid('address')) {
                  <span class="text-error text-xs mt-1">Máximo {{ addressMaxLength }} caracteres.</span>
                }
              </label>
              <label class="form-control md:col-span-2">
                <div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Estado</span></div>
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

  readonly addressMaxLength = ADDRESS_MAX_LENGTH

  editForm = this.fb.group({
    name: [''],
    contact_email: ['', Validators.email],
    contact_phone: ['', Validators.pattern(PHONE_PATTERN)],
    tax_id: ['', Validators.pattern(CUIT_PATTERN)],
    address: ['', Validators.maxLength(ADDRESS_MAX_LENGTH)],
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
        { name: 'ID', content: t.id, icon: 'bi bi-hash' },
        { name: 'Estado', content: t.status, type: 'badge', contentClass: this.statusBadge(t.status), icon: 'bi bi-circle' },
        { name: 'Email de contacto', content: orDash(t.contact_email), icon: 'bi bi-envelope' },
        { name: 'Teléfono de contacto', content: orDash(t.contact_phone), icon: 'bi bi-telephone' },
        { name: 'CUIT/CUIL', content: formatCuit(t.tax_id), icon: 'bi bi-file-earmark-text' },
        { name: 'Dirección', content: orDash(t.address), icon: 'bi bi-geo-alt' },
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
      this.patchEditForm()
    }
  }

  openEdit() {
    this.patchEditForm()
    this.editConfigValues.set(existingConfigToValues(this.tenant.config ?? {}, this.configDefs()))
    this.showEdit.set(true)
  }

  invalid(control: string) {
    const c = this.editForm.get(control)
    return !!c && c.invalid && (c.dirty || c.touched)
  }

  onUpdate() {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched()
      this.toast.toast({ severity: 'warning', body: 'Revisá los campos con formato inválido.' })
      return
    }
    const v = this.editForm.getRawValue()
    // Contact fields are always sent: an empty string clears the stored value.
    const body: UpdateTenantInput = {
      contact_email: v.contact_email?.trim() ?? '',
      contact_phone: v.contact_phone?.trim() ?? '',
      tax_id: v.tax_id?.trim() ?? '',
      address: v.address?.trim() ?? '',
    }
    if (v.name) body.name = v.name
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

  private patchEditForm() {
    this.editForm.reset({
      name: this.tenant.name,
      contact_email: this.tenant.contact_email ?? '',
      contact_phone: this.tenant.contact_phone ?? '',
      tax_id: this.tenant.tax_id ? formatCuit(this.tenant.tax_id) : '',
      address: this.tenant.address ?? '',
      status: this.tenant.status,
    })
  }

  private statusBadge(status: string) {
    return STATUS_BADGE[status] ?? 'badge-ghost'
  }

  private fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
  }
}
