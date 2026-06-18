import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  signal,
  SimpleChanges,
} from '@angular/core'
import { FormBuilder } from '@angular/forms'
import type { FormField, InfoCardData } from '@germanmacchia/angular-ui'
import { Form, InfoCard, ToastService } from '@germanmacchia/angular-ui'
import type { Tenant } from '../../../core/models/tenant.model'
import { AdminService } from '../../../core/services/admin.service'

const STATUS_BADGE: Record<string, string> = {
  active: 'badge-success',
  trial: 'badge-warning',
  suspended: 'badge-error',
  cancelled: 'badge-ghost',
}

@Component({
  selector: 'app-tenant-overview',
  standalone: true,
  imports: [Form, InfoCard],
  template: `
    <div class="flex flex-col gap-4 max-w-xl">
      <lib-info-card [data]="cardData" />
      <div class="flex justify-end">
        <button class="btn btn-primary btn-sm" (click)="showEdit.set(true)">
          <i class="bi bi-pencil"></i> Editar
        </button>
      </div>
    </div>

    <lib-form
      [formGroup]="editForm"
      [fields]="editFields"
      [displayMode]="'modal'"
      [title]="'Editar tenant'"
      [isOpen]="showEdit()"
      (submitEvent)="onUpdate()"
      (cancelEvent)="showEdit.set(false)" />
  `,
})
export class TenantOverviewComponent implements OnChanges {
  @Input() tenant!: Tenant
  @Input() tenantId!: string
  @Output() tenantUpdated = new EventEmitter<Tenant>()

  private admin = inject(AdminService)
  private fb = inject(FormBuilder)
  private toast = inject(ToastService)

  showEdit = signal(false)

  editForm = this.fb.group({
    name: [''],
    domain: [''],
    status: ['active'],
  })

  editFields: FormField[] = [
    { name: 'name', label: 'Nombre', type: 'text', placeholder: 'Nombre del tenant' },
    { name: 'domain', label: 'Dominio', type: 'text', placeholder: 'acme.example.com' },
    {
      name: 'status',
      label: 'Estado',
      type: 'select',
      options: [
        { label: 'Activo', value: 'active' },
        { label: 'Trial', value: 'trial' },
        { label: 'Suspendido', value: 'suspended' },
        { label: 'Cancelado', value: 'cancelled' },
      ],
    },
  ]

  get cardData(): InfoCardData {
    const t = this.tenant
    if (!t) return { title: '', sections: [] }
    return {
      title: t.name,
      titleIcon: 'bi bi-building',
      layout: 'grid',
      gridCols: 2,
      sections: [
        {
          name: 'Estado',
          content: t.status,
          type: 'badge',
          contentClass: this.statusBadge(t.status),
          icon: 'bi bi-circle',
        },
        { name: 'Dominio', content: t.domain ?? '—', icon: 'bi bi-globe' },
        { name: 'Plan', content: t.plan?.name ?? '—', icon: 'bi bi-credit-card' },
        { name: 'Precio', content: t.plan ? `$${t.plan.price}` : '—', icon: 'bi bi-cash' },
        { name: 'Creado', content: this.fmtDate(t.created_at), icon: 'bi bi-calendar' },
        { name: 'Actualizado', content: this.fmtDate(t.updated_at), icon: 'bi bi-clock' },
      ],
    }
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

  onUpdate() {
    const v = this.editForm.getRawValue()
    const body: { name?: string; domain?: string; status?: string } = {}
    if (v.name) body.name = v.name
    if (v.domain !== undefined) body.domain = v.domain || undefined
    if (v.status) body.status = v.status

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
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }
}
