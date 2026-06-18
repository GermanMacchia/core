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
import type { Portal, TenantUser } from '../../../core/models/tenant.model'
import { AdminService } from '../../../core/services/admin.service'

@Component({
  selector: 'app-tenant-users',
  standalone: true,
  imports: [CompactList, CompactListCellDirective, Form],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex justify-end">
        <button class="btn btn-primary btn-sm" (click)="showCreateUser.set(true)">
          <i class="bi bi-person-plus"></i> Nuevo usuario
        </button>
      </div>

      @if (usersError()) {
        <div class="alert alert-error text-sm">{{ usersError() }}</div>
      }

      <lib-compact-list
        [items]="users()"
        [columns]="userColumns"
        [actions]="userActions"
        [loading]="loadingUsers()"
        [emptyIcon]="'bi bi-people'"
        [emptyMessage]="'Sin usuarios'"
        [trackByKey]="'id'"
        [booleanTrueLabel]="'Activo'"
        [booleanFalseLabel]="'Inactivo'"
        (actionClick)="onUserAction($event)">
        <ng-template compactListCell="portal_id" let-item>
          <span class="text-xs text-base-content/60">
            {{ item.portal_id ? (portalMap().get(item.portal_id) ?? '—') : '—' }}
          </span>
        </ng-template>
        <ng-template compactListCell="last_login_at" let-item>
          <span class="text-xs text-base-content/60">
            {{ item.last_login_at ? fmtDate(item.last_login_at) : 'Nunca' }}
          </span>
        </ng-template>
      </lib-compact-list>
    </div>

    <lib-form
      [formGroup]="userForm"
      [fields]="userFields()"
      [displayMode]="'modal'"
      [title]="'Nuevo usuario'"
      [isOpen]="showCreateUser()"
      (submitEvent)="onCreateUser()"
      (cancelEvent)="showCreateUser.set(false)" />

    <lib-form
      [formGroup]="editUserForm"
      [fields]="editUserFields()"
      [displayMode]="'modal'"
      [title]="'Editar usuario'"
      [isOpen]="showEditUser()"
      (submitEvent)="onUpdateUser()"
      (cancelEvent)="showEditUser.set(false)" />
  `,
})
export class TenantUsersComponent implements OnInit {
  @Input() tenantId!: string

  private admin = inject(AdminService)
  private fb = inject(FormBuilder)
  private toast = inject(ToastService)
  private infoModal = inject(InfoModalService)

  users = signal<TenantUser[]>([])
  loadingUsers = signal(false)
  usersError = signal<string | null>(null)

  portals = signal<Portal[]>([])
  portalMap = computed(() => new Map(this.portals().map(p => [p.id, p.name])))

  showCreateUser = signal(false)
  showEditUser = signal(false)
  private editUserTarget: TenantUser | null = null

  userForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    role: ['member'],
    portal_id: [''],
  })

  editUserForm = this.fb.group({
    role: ['member'],
    is_active: [true],
    portal_id: [''],
  })

  private roleOptions = [
    { label: 'Admin', value: 'admin' },
    { label: 'Member', value: 'member' },
    { label: 'Viewer', value: 'viewer' },
  ]

  userFields = computed<FormField[]>(() => [
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'password', label: 'Contraseña', type: 'password', required: true },
    { name: 'role', label: 'Rol', type: 'select', options: this.roleOptions },
    {
      name: 'portal_id',
      label: 'Portal',
      type: 'select',
      options: [
        { label: '— Sin portal —', value: '' },
        ...this.portals().map(p => ({ label: p.name, value: p.id })),
      ],
    },
  ])

  editUserFields = computed<FormField[]>(() => [
    { name: 'role', label: 'Rol', type: 'select', options: this.roleOptions },
    {
      name: 'is_active',
      label: 'Estado',
      type: 'select',
      options: [
        { label: 'Activo', value: true },
        { label: 'Inactivo', value: false },
      ],
    },
    {
      name: 'portal_id',
      label: 'Portal',
      type: 'select',
      options: [
        { label: '— Sin portal —', value: '' },
        ...this.portals().map(p => ({ label: p.name, value: p.id })),
      ],
    },
  ])

  userColumns: CompactListColumn<TenantUser>[] = [
    { key: 'email', prop: 'email', header: 'Email', type: 'text' },
    { key: 'role', prop: 'role', header: 'Rol', type: 'badge' },
    { key: 'portal_id', header: 'Portal', type: 'custom' },
    { key: 'is_active', prop: 'is_active', header: 'Activo', type: 'boolean' },
    { key: 'last_login_at', header: 'Último acceso', type: 'custom' },
  ]

  userActions: CompactListAction<TenantUser>[] = [
    { id: 'edit', icon: 'bi bi-pencil', tooltip: 'Editar' },
    { id: 'delete', icon: 'bi bi-trash', tooltip: 'Eliminar', class: 'text-error' },
  ]

  ngOnInit() {
    this.loadUsers()
    this.loadPortals()
  }

  onCreateUser() {
    if (this.userForm.invalid) {
      this.toast.toast({ severity: 'warning', body: 'Email y contraseña son requeridos.' })
      return
    }
    const v = this.userForm.getRawValue()
    this.admin
      .createTenantUser(this.tenantId, {
        email: v.email!,
        password: v.password!,
        role: v.role ?? 'member',
        ...(v.portal_id ? { portal_id: v.portal_id } : {}),
      })
      .subscribe({
        next: res => {
          this.users.update(list => [...list, res.data])
          this.showCreateUser.set(false)
          this.userForm.reset({ role: 'member', portal_id: '' })
          this.toast.toast({ severity: 'success', body: `Usuario "${res.data.email}" creado.` })
        },
        error: err => {
          this.toast.toast({
            severity: 'error',
            body: err.error?.error ?? 'Error al crear el usuario.',
          })
        },
      })
  }

  onUserAction(event: { action: string; item: TenantUser }) {
    if (event.action === 'edit') {
      this.editUserTarget = event.item
      this.editUserForm.patchValue({
        role: event.item.role,
        is_active: event.item.is_active,
        portal_id: event.item.portal_id ?? '',
      })
      this.showEditUser.set(true)
    } else if (event.action === 'delete') {
      this.infoModal.openAsConfirm(
        () => this.doDeleteUser(event.item),
        `¿Eliminar al usuario "${event.item.email}"?`,
      )
    }
  }

  onUpdateUser() {
    if (!this.editUserTarget) return
    const v = this.editUserForm.getRawValue()
    const body: { role?: string; is_active?: boolean; portal_id?: string } = {}
    if (v.role) body.role = v.role
    if (v.is_active != null) body.is_active = v.is_active
    if (v.portal_id) body.portal_id = v.portal_id

    this.admin.updateTenantUser(this.tenantId, this.editUserTarget.id, body).subscribe({
      next: res => {
        this.users.update(list => list.map(u => (u.id === res.data.id ? res.data : u)))
        this.showEditUser.set(false)
        this.editUserTarget = null
        this.toast.toast({
          severity: 'success',
          body: `Usuario "${res.data.email}" actualizado.`,
        })
      },
      error: err => {
        this.toast.toast({
          severity: 'error',
          body: err.error?.error ?? 'Error al actualizar el usuario.',
        })
      },
    })
  }

  fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  private loadUsers() {
    this.loadingUsers.set(true)
    this.usersError.set(null)
    this.admin.getTenantUsers(this.tenantId).subscribe({
      next: res => {
        this.users.set(res.data ?? [])
        this.loadingUsers.set(false)
      },
      error: err => {
        this.usersError.set(err.error?.error ?? 'Error al cargar usuarios.')
        this.loadingUsers.set(false)
      },
    })
  }

  private loadPortals() {
    this.admin.listPortals(this.tenantId).subscribe({
      next: res => this.portals.set(res.data ?? []),
    })
  }

  private doDeleteUser(user: TenantUser) {
    this.admin.deleteTenantUser(this.tenantId, user.id).subscribe({
      next: () => {
        this.users.update(list => list.filter(u => u.id !== user.id))
        this.toast.toast({ severity: 'success', body: `Usuario "${user.email}" eliminado.` })
      },
      error: () => {
        this.toast.toast({ severity: 'error', body: 'Error al eliminar el usuario.' })
      },
    })
  }
}
