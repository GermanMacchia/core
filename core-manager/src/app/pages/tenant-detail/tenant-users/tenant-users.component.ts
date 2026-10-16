import { Component, computed, inject, input, type OnInit, signal } from '@angular/core'
import type { HttpErrorResponse } from '@angular/common/http'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms'
import { catchError, map, of, switchMap, tap } from 'rxjs'
import type { CompactListAction, CompactListColumn, FormField } from '@germanmacchia/angular-ui'
import {
  CompactList,
  CompactListCellDirective,
  Form,
  InfoModalService,
  ToastService,
} from '@germanmacchia/angular-ui'
import type { Portal, RoleOption, ServiceAccessGrant, TenantService, TenantUser } from '../../../core/models/tenant.model'
import { AdminService } from '../../../core/services/admin.service'
import { apiErrorMessage } from '../../../core/utils/api-error'

@Component({
  selector: 'app-tenant-users',
  standalone: true,
  imports: [CompactList, CompactListCellDirective, Form, ReactiveFormsModule],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex justify-between items-center">
        <label class="label cursor-pointer justify-start gap-2">
          <input
            type="checkbox"
            class="toggle toggle-sm"
            [checked]="showInactive()"
            (change)="onToggleShowInactive($event)">
          <span class="label-text text-sm">Ver inactivos</span>
        </label>
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
        <ng-template compactListCell="row_action" let-item>
          @if (item.is_active) {
            <button
              type="button"
              class="btn btn-ghost btn-xs text-error"
              [disabled]="saving()"
              (click)="onUserAction({ action: 'delete', item })">
              @if (pendingUserId() === item.id) {
                <span class="loading loading-spinner loading-xs"></span>
              } @else {
                <i class="bi bi-trash"></i>
              }
              Eliminar
            </button>
          } @else {
            <button
              type="button"
              class="btn btn-ghost btn-xs"
              [disabled]="saving()"
              (click)="onUserAction({ action: 'restore', item })">
              @if (pendingUserId() === item.id) {
                <span class="loading loading-spinner loading-xs"></span>
              } @else {
                <i class="bi bi-arrow-counterclockwise"></i>
              }
              Restaurar
            </button>
          }
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

    <!-- Grants Modal -->
    <dialog class="modal" [class.modal-open]="showGrants()">
      <div class="modal-box w-11/12 max-w-2xl flex flex-col p-0 max-h-[90vh]">
        <div class="px-6 py-4 border-b border-base-200 flex items-center justify-between">
          <h3 class="font-semibold text-lg">Servicios de {{ grantsTarget()?.email }}</h3>
          <button type="button" class="btn btn-ghost btn-sm btn-circle" (click)="showGrants.set(false)">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
        <div class="px-6 py-5 flex-1 overflow-y-auto flex flex-col gap-4">
          <form [formGroup]="grantForm" class="flex items-end gap-2 flex-wrap">
            <label class="form-control flex-1 min-w-[180px]">
              <div class="label pt-0 pb-1"><span class="label-text text-xs font-medium">Negocio</span></div>
              <select formControlName="business_id" class="select select-bordered select-sm">
                <option value="">Seleccionar...</option>
                @for (opt of businessOptions(); track opt.value) {
                  <option [value]="opt.value">{{ opt.label }}</option>
                }
              </select>
            </label>
            <label class="form-control flex-1 min-w-[140px]">
              <div class="label pt-0 pb-1"><span class="label-text text-xs font-medium">Rol</span></div>
              <select formControlName="role_id" class="select select-bordered select-sm">
                <option value="">Seleccionar...</option>
                @for (opt of grantRoleOptions(); track opt.id) {
                  <option [value]="opt.id">{{ opt.name }}</option>
                }
              </select>
            </label>
            <button type="button" class="btn btn-primary btn-sm" [disabled]="saving()" (click)="onAddGrant()">
              @if (saving()) {
                <span class="loading loading-spinner loading-xs"></span>
              } @else {
                <i class="bi bi-plus-lg"></i>
              }
              Agregar
            </button>
          </form>

          <lib-compact-list
            [items]="grants()"
            [columns]="grantColumns"
            [actions]="grantActions"
            [loading]="loadingGrants()"
            [emptyIcon]="'bi bi-diagram-3'"
            [emptyMessage]="'Sin accesos otorgados'"
            [trackByKey]="'id'"
            (actionClick)="onGrantAction($event)">
          </lib-compact-list>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" (click)="showGrants.set(false)"><button>close</button></form>
    </dialog>
  `,
})
export class TenantUsersComponent implements OnInit {
  readonly tenantId = input.required<string>()

  private admin = inject(AdminService)
  private fb = inject(FormBuilder)
  private toast = inject(ToastService)
  private infoModal = inject(InfoModalService)

  users = signal<TenantUser[]>([])
  loadingUsers = signal(false)
  usersError = signal<string | null>(null)
  // lib-form exposes no disabled/loading input, so submit handlers check this
  // flag to prevent double submission.
  saving = signal(false)
  // Row whose delete/restore request is in flight, to show its spinner.
  pendingUserId = signal<string | null>(null)

  portals = signal<Portal[]>([])
  portalMap = computed(() => new Map(this.portals().map(p => [p.id, p.name])))

  showCreateUser = signal(false)
  showEditUser = signal(false)
  private editUserTarget: TenantUser | null = null

  showGrants = signal(false)
  grantsTarget = signal<TenantUser | null>(null)
  grants = signal<ServiceAccessGrant[]>([])
  loadingGrants = signal(false)
  tenantServices = signal<TenantService[]>([])
  grantRoleOptions = signal<RoleOption[]>([])

  grantForm = this.fb.nonNullable.group({
    business_id: ['', Validators.required],
    role_id: ['', Validators.required],
  })

  businessOptions = computed(() =>
    this.tenantServices().flatMap(s =>
      s.business
        ? [{ label: `${s.name} — ${s.business.name}`, value: s.business.id, serviceId: s.id }]
        : [],
    ),
  )

  grantColumns: CompactListColumn<ServiceAccessGrant>[] = [
    { key: 'business_name', prop: 'business_name', header: 'Negocio', type: 'text' },
    { key: 'service_name', prop: 'service_name', header: 'Servicio', type: 'text' },
    { key: 'role_name', prop: 'role_name', header: 'Rol', type: 'badge' },
  ]

  grantActions: CompactListAction<ServiceAccessGrant>[] = [
    { id: 'delete', icon: 'bi bi-trash', tooltip: 'Quitar acceso', class: 'text-error' },
  ]

  userForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    role: ['member'],
    portal_id: [''],
  })

  editUserForm = this.fb.nonNullable.group({
    role: ['member'],
    is_active: [true],
    portal_id: [''],
    restrict_services: [false],
    password: [''],
  })

  private roleOptions = [
    { label: 'Admin', value: 'admin' },
    { label: 'Miembro', value: 'member' },
    { label: 'Lector', value: 'viewer' },
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
    {
      name: 'restrict_services',
      label: 'Restringir a servicios asignados',
      type: 'select',
      options: [
        { label: 'Sí', value: true },
        { label: 'No', value: false },
      ],
    },
    { name: 'password', label: 'Nueva contraseña (opcional)', type: 'password' },
  ])

  userColumns: CompactListColumn<TenantUser>[] = [
    { key: 'email', prop: 'email', header: 'Email', type: 'text' },
    { key: 'role', prop: 'role', header: 'Rol', type: 'badge' },
    { key: 'portal_id', header: 'Portal', type: 'custom' },
    { key: 'is_active', prop: 'is_active', header: 'Activo', type: 'boolean' },
    { key: 'last_login_at', header: 'Último acceso', type: 'custom' },
    { key: 'row_action', header: '', type: 'custom' },
  ]

  userActions: CompactListAction<TenantUser>[] = [
    { id: 'edit', icon: 'bi bi-pencil', tooltip: 'Editar' },
    { id: 'services', icon: 'bi bi-diagram-3', tooltip: 'Servicios' },
  ]

  showInactive = signal(false)

  constructor() {
    // Reload the role options whenever the selected business changes;
    // switchMap drops in-flight requests for a previous selection.
    this.grantForm.controls.business_id.valueChanges
      .pipe(
        tap(() => this.grantForm.patchValue({ role_id: '' }, { emitEvent: false })),
        switchMap(businessId => {
          const opt = this.businessOptions().find(o => o.value === businessId)
          if (!opt) return of<RoleOption[]>([])
          return this.admin.listRolesByService(opt.serviceId).pipe(
            map(res => res.data ?? []),
            catchError((err: HttpErrorResponse) => {
              this.toast.toast({ severity: 'error', body: apiErrorMessage(err, 'Error al cargar los roles del servicio.') })
              return of<RoleOption[]>([])
            }),
          )
        }),
        takeUntilDestroyed(),
      )
      .subscribe(roles => this.grantRoleOptions.set(roles))
  }

  ngOnInit() {
    this.loadUsers()
    this.loadPortals()
  }

  onCreateUser() {
    if (this.userForm.invalid) {
      this.toast.toast({ severity: 'warning', body: 'Email y contraseña son requeridos.' })
      return
    }
    if (this.saving()) return
    const v = this.userForm.getRawValue()
    this.saving.set(true)
    this.admin
      .createTenantUser(this.tenantId(), {
        email: v.email,
        password: v.password,
        role: v.role,
        ...(v.portal_id ? { portal_id: v.portal_id } : {}),
      })
      .subscribe({
        next: res => {
          this.saving.set(false)
          this.users.update(list => [...list, res.data])
          this.showCreateUser.set(false)
          this.userForm.reset()
          this.toast.toast({ severity: 'success', body: `Usuario "${res.data.email}" creado.` })
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false)
          this.toast.toast({
            severity: 'error',
            body: apiErrorMessage(err, 'Error al crear el usuario.'),
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
        restrict_services: event.item.restrict_services,
        password: '',
      })
      this.showEditUser.set(true)
    } else if (event.action === 'delete') {
      this.infoModal.openAsConfirm(
        () => this.doDeleteUser(event.item),
        `¿Eliminar al usuario "${event.item.email}"?`,
      )
    } else if (event.action === 'restore') {
      this.doRestoreUser(event.item)
    } else if (event.action === 'services') {
      this.openGrants(event.item)
    }
  }

  onToggleShowInactive(event: Event) {
    this.showInactive.set((event.target as HTMLInputElement).checked)
    this.loadUsers()
  }

  onUpdateUser() {
    if (!this.editUserTarget || this.saving()) return
    const v = this.editUserForm.getRawValue()
    const body: Parameters<AdminService['updateTenantUser']>[2] = {
      is_active: v.is_active,
      restrict_services: v.restrict_services,
    }
    if (v.role) body.role = v.role
    // core-backend cannot clear portal_id yet (null/omitted keeps the current
    // value via COALESCE, "" is rejected as an invalid UUID), so
    // "— Sin portal —" leaves the existing portal untouched.
    if (v.portal_id) body.portal_id = v.portal_id
    if (v.password) body.password = v.password

    this.saving.set(true)
    this.admin.updateTenantUser(this.tenantId(), this.editUserTarget.id, body).subscribe({
      next: res => {
        this.saving.set(false)
        this.users.update(list => list.map(u => (u.id === res.data.id ? res.data : u)))
        this.showEditUser.set(false)
        this.editUserTarget = null
        this.toast.toast({
          severity: 'success',
          body: `Usuario "${res.data.email}" actualizado.`,
        })
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false)
        this.toast.toast({
          severity: 'error',
          body: apiErrorMessage(err, 'Error al actualizar el usuario.'),
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
    this.admin.getTenantUsers(this.tenantId(), this.showInactive()).subscribe({
      next: res => {
        this.users.set(res.data ?? [])
        this.loadingUsers.set(false)
      },
      error: (err: HttpErrorResponse) => {
        this.usersError.set(apiErrorMessage(err, 'Error al cargar usuarios.'))
        this.loadingUsers.set(false)
      },
    })
  }

  private loadPortals() {
    this.admin.listPortals(this.tenantId()).subscribe({
      next: res => this.portals.set(res.data ?? []),
      error: (err: HttpErrorResponse) => {
        this.toast.toast({ severity: 'error', body: apiErrorMessage(err, 'Error al cargar los portales.') })
      },
    })
  }

  private doDeleteUser(user: TenantUser) {
    if (this.saving()) return
    this.saving.set(true)
    this.pendingUserId.set(user.id)
    this.admin.deleteTenantUser(this.tenantId(), user.id).subscribe({
      next: () => {
        this.saving.set(false)
        this.pendingUserId.set(null)
        if (this.showInactive()) {
          this.users.update(list =>
            list.map(u => (u.id === user.id ? { ...u, is_active: false } : u)),
          )
        } else {
          this.users.update(list => list.filter(u => u.id !== user.id))
        }
        this.toast.toast({ severity: 'success', body: `Usuario "${user.email}" eliminado.` })
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false)
        this.pendingUserId.set(null)
        this.toast.toast({ severity: 'error', body: apiErrorMessage(err, 'Error al eliminar el usuario.') })
      },
    })
  }

  private doRestoreUser(user: TenantUser) {
    if (this.saving()) return
    this.saving.set(true)
    this.pendingUserId.set(user.id)
    this.admin.updateTenantUser(this.tenantId(), user.id, { is_active: true }).subscribe({
      next: res => {
        this.saving.set(false)
        this.pendingUserId.set(null)
        this.users.update(list => list.map(u => (u.id === res.data.id ? res.data : u)))
        this.toast.toast({ severity: 'success', body: `Usuario "${user.email}" restaurado.` })
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false)
        this.pendingUserId.set(null)
        this.toast.toast({ severity: 'error', body: apiErrorMessage(err, 'Error al restaurar el usuario.') })
      },
    })
  }

  openGrants(user: TenantUser) {
    this.grantsTarget.set(user)
    this.grantForm.reset()
    this.grantRoleOptions.set([])
    this.showGrants.set(true)
    this.loadGrants(user.id)
    if (this.tenantServices().length === 0) {
      this.admin.listTenantServices(this.tenantId()).subscribe({
        next: res => this.tenantServices.set(res.data ?? []),
        error: (err: HttpErrorResponse) => {
          this.toast.toast({ severity: 'error', body: apiErrorMessage(err, 'Error al cargar los negocios del tenant.') })
        },
      })
    }
  }

  private loadGrants(userId: string) {
    this.loadingGrants.set(true)
    this.admin.listUserServiceAccess(this.tenantId(), userId).subscribe({
      next: res => {
        this.grants.set(res.data ?? [])
        this.loadingGrants.set(false)
      },
      error: (err: HttpErrorResponse) => {
        this.loadingGrants.set(false)
        this.toast.toast({ severity: 'error', body: apiErrorMessage(err, 'Error al cargar los accesos del usuario.') })
      },
    })
  }

  onAddGrant() {
    const target = this.grantsTarget()
    if (!target || this.grantForm.invalid) {
      this.toast.toast({ severity: 'warning', body: 'Seleccioná un negocio y un rol.' })
      return
    }
    if (this.saving()) return
    const v = this.grantForm.getRawValue()
    this.saving.set(true)
    this.admin
      .createUserServiceAccess(this.tenantId(), target.id, {
        business_id: v.business_id,
        role_id: v.role_id,
      })
      .subscribe({
        next: res => {
          this.saving.set(false)
          this.grants.update(list => [...list, res.data])
          this.grantForm.reset()
          this.toast.toast({ severity: 'success', body: 'Acceso otorgado.' })
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false)
          this.toast.toast({
            severity: 'error',
            body: apiErrorMessage(err, 'Error al otorgar el acceso.'),
          })
        },
      })
  }

  onGrantAction(event: { action: string; item: ServiceAccessGrant }) {
    if (event.action === 'delete') {
      this.infoModal.openAsConfirm(
        () => this.doDeleteGrant(event.item),
        `¿Quitar el acceso a "${event.item.business_name}"?`,
      )
    }
  }

  private doDeleteGrant(grant: ServiceAccessGrant) {
    const target = this.grantsTarget()
    if (!target || this.saving()) return
    this.saving.set(true)
    this.admin.deleteUserServiceAccess(this.tenantId(), target.id, grant.id).subscribe({
      next: () => {
        this.saving.set(false)
        this.grants.update(list => list.filter(g => g.id !== grant.id))
        this.toast.toast({ severity: 'success', body: 'Acceso eliminado.' })
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false)
        this.toast.toast({
          severity: 'error',
          body: apiErrorMessage(err, 'Error al eliminar el acceso.'),
        })
      },
    })
  }
}
