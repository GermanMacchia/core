import { Component, inject, OnInit, signal } from '@angular/core'
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms'
import {
	CompactList,
	CompactListCellDirective,
	ToastService,
	InfoModalService,
} from '@germanmacchia/angular-ui'
import type { CompactListColumn, CompactListAction } from '@germanmacchia/angular-ui'
import { AdminService } from '../../core/services/admin.service'
import { Faq, Portal, Service } from '../../core/models/tenant.model'

@Component({
	selector: 'app-faqs',
	standalone: true,
	imports: [CompactList, CompactListCellDirective, ReactiveFormsModule],
	template: `
		<div class="p-6 lg:p-10 max-w-6xl">
			<div class="flex items-center justify-between mb-6">
				<div>
					<h1 class="text-2xl font-bold text-base-content">FAQs</h1>
					<p class="text-base-content/50 text-sm">{{ faqs().length }} preguntas frecuentes registradas</p>
				</div>
				<button class="btn btn-primary btn-sm" (click)="openCreate()">
					<i class="bi bi-plus-lg"></i> Nueva FAQ
				</button>
			</div>

			<lib-compact-list
				[items]="faqs()"
				[columns]="columns"
				[actions]="actions"
				[loading]="loading()"
				[emptyIcon]="'bi bi-patch-question'"
				[emptyMessage]="'Sin FAQs registradas'"
				[pageSize]="20"
				[trackByKey]="'id'"
				[booleanTrueLabel]="'Activo'"
				[booleanFalseLabel]="'Inactivo'"
				(actionClick)="onAction($event)">
				<ng-template compactListCell="answer" let-item>
					<span class="text-xs text-base-content/60">{{ truncate(item.answer) }}</span>
				</ng-template>
				<ng-template compactListCell="assignments" let-item>
					<span class="text-xs text-base-content/60">
						{{ item.service_ids.length }} servicios, {{ item.portal_ids.length }} portales
					</span>
				</ng-template>
			</lib-compact-list>
		</div>

		<!-- Create Modal -->
		<dialog class="modal" [class.modal-open]="showCreate()">
			<div class="modal-box w-11/12 max-w-lg flex flex-col p-0 max-h-[90vh]">
				<div class="px-6 py-4 border-b border-base-200">
					<h3 class="font-semibold text-lg">Nueva FAQ</h3>
				</div>
				<form [formGroup]="createForm" class="flex flex-col overflow-hidden">
					<div class="px-6 py-5 flex-1 overflow-y-auto">
						<div class="grid grid-cols-1 gap-y-5">
							<label class="form-control">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Pregunta <span class="text-error text-xs">*</span></span></div>
								<textarea formControlName="question" class="textarea textarea-bordered resize-none" rows="2" placeholder="¿Cómo...?"></textarea>
							</label>
							<label class="form-control">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Respuesta <span class="text-error text-xs">*</span></span></div>
								<textarea formControlName="answer" class="textarea textarea-bordered resize-none" rows="4" placeholder="Respuesta..."></textarea>
							</label>
							<label class="form-control">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Orden</span></div>
								<input formControlName="sort_order" type="number" class="input input-bordered" placeholder="0">
							</label>
						</div>
					</div>
					<div class="px-6 py-4 border-t border-base-200 flex justify-end gap-2">
						<button type="button" class="btn btn-ghost btn-sm" (click)="showCreate.set(false)">Cancelar</button>
						<button type="button" class="btn btn-primary btn-sm" (click)="onCreate()">Crear</button>
					</div>
				</form>
			</div>
			<form method="dialog" class="modal-backdrop" (click)="showCreate.set(false)"><button>close</button></form>
		</dialog>

		<!-- Edit Modal -->
		<dialog class="modal" [class.modal-open]="showEdit()">
			<div class="modal-box w-11/12 max-w-lg flex flex-col p-0 max-h-[90vh]">
				<div class="px-6 py-4 border-b border-base-200">
					<h3 class="font-semibold text-lg">Editar FAQ</h3>
				</div>
				<form [formGroup]="editForm" class="flex flex-col overflow-hidden">
					<div class="px-6 py-5 flex-1 overflow-y-auto">
						<div class="grid grid-cols-1 gap-y-5">
							<label class="form-control">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Pregunta</span></div>
								<textarea formControlName="question" class="textarea textarea-bordered resize-none" rows="2"></textarea>
							</label>
							<label class="form-control">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Respuesta</span></div>
								<textarea formControlName="answer" class="textarea textarea-bordered resize-none" rows="4"></textarea>
							</label>
							<label class="form-control">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Orden</span></div>
								<input formControlName="sort_order" type="number" class="input input-bordered" placeholder="0">
							</label>
							<label class="form-control">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Estado</span></div>
								<select formControlName="is_active" class="select select-bordered">
									<option [ngValue]="true">Activo</option>
									<option [ngValue]="false">Inactivo</option>
								</select>
							</label>
						</div>
					</div>
					<div class="px-6 py-4 border-t border-base-200 flex justify-end gap-2">
						<button type="button" class="btn btn-ghost btn-sm" (click)="showEdit.set(false)">Cancelar</button>
						<button type="button" class="btn btn-primary btn-sm" (click)="onUpdate()">Guardar</button>
					</div>
				</form>
			</div>
			<form method="dialog" class="modal-backdrop" (click)="showEdit.set(false)"><button>close</button></form>
		</dialog>

		<!-- Assignments Modal -->
		<dialog class="modal" [class.modal-open]="showAssignments()">
			<div class="modal-box w-11/12 max-w-2xl flex flex-col p-0 max-h-[90vh]">
				<div class="px-6 py-4 border-b border-base-200">
					<h3 class="font-semibold text-lg">Asignaciones de la FAQ</h3>
					<p class="text-xs text-base-content/50">{{ assignmentsTarget()?.question }}</p>
				</div>
				<div class="px-6 py-5 flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
					<div>
						<h4 class="text-sm font-medium mb-2">Servicios</h4>
						<div class="flex flex-col gap-2">
							@for (service of services(); track service.id) {
								<label class="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										class="checkbox checkbox-sm"
										[checked]="isServiceAssigned(service.id)"
										(change)="onToggleService(service.id, $event)">
									<span class="text-sm">{{ service.name }}</span>
								</label>
							}
							@if (!services().length) {
								<span class="text-xs text-base-content/50">Sin servicios en el catálogo</span>
							}
						</div>
					</div>
					<div>
						<h4 class="text-sm font-medium mb-2">Portales</h4>
						<div class="flex flex-col gap-2">
							@for (portal of portals(); track portal.id) {
								<label class="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										class="checkbox checkbox-sm"
										[checked]="isPortalAssigned(portal.id)"
										(change)="onTogglePortal(portal.id, $event)">
									<span class="text-sm">{{ portal.name }}</span>
								</label>
							}
							@if (!portals().length) {
								<span class="text-xs text-base-content/50">Sin portales registrados</span>
							}
						</div>
					</div>
				</div>
				<div class="px-6 py-4 border-t border-base-200 flex justify-end gap-2">
					<button type="button" class="btn btn-ghost btn-sm" (click)="showAssignments.set(false)">Cerrar</button>
				</div>
			</div>
			<form method="dialog" class="modal-backdrop" (click)="showAssignments.set(false)"><button>close</button></form>
		</dialog>
	`,
})
export class FaqsComponent implements OnInit {
	private admin = inject(AdminService)
	private fb = inject(FormBuilder)
	private toast = inject(ToastService)
	private infoModal = inject(InfoModalService)

	faqs = signal<Faq[]>([])
	loading = signal(true)

	services = signal<Service[]>([])
	portals = signal<Portal[]>([])

	showCreate = signal(false)
	showEdit = signal(false)
	showAssignments = signal(false)
	private editTarget: Faq | null = null
	assignmentsTarget = signal<Faq | null>(null)

	createForm = this.fb.group({
		question: ['', Validators.required],
		answer: ['', Validators.required],
		sort_order: [0],
	})

	editForm = this.fb.group({
		question: [''],
		answer: [''],
		sort_order: [0],
		is_active: [true],
	})

	columns: CompactListColumn<Faq>[] = [
		{ key: 'question', prop: 'question', header: 'Pregunta', type: 'text' },
		{ key: 'answer', header: 'Respuesta', type: 'custom' },
		{ key: 'assignments', header: 'Asignaciones', type: 'custom' },
		{ key: 'sort_order', prop: 'sort_order', header: 'Orden', type: 'text' },
		{ key: 'is_active', prop: 'is_active', header: 'Activo', type: 'boolean' },
	]

	actions: CompactListAction<Faq>[] = [
		{ id: 'edit', icon: 'bi bi-pencil', tooltip: 'Editar' },
		{ id: 'assignments', icon: 'bi bi-link-45deg', tooltip: 'Asignaciones' },
		{ id: 'delete', icon: 'bi bi-trash', tooltip: 'Eliminar', class: 'text-error' },
	]

	ngOnInit() {
		this.load()
		this.admin.listServices(true).subscribe({ next: res => this.services.set(res.data ?? []) })
		this.admin.listAllPortals().subscribe({ next: res => this.portals.set(res.data ?? []) })
	}

	truncate(text: string): string {
		return text.length > 60 ? `${text.slice(0, 60)}…` : text
	}

	load() {
		this.loading.set(true)
		this.admin.listFaqs().subscribe({
			next: res => {
				this.faqs.set(res.data ?? [])
				this.loading.set(false)
			},
			error: () => {
				this.toast.toast({ severity: 'error', body: 'Error al cargar las FAQs.' })
				this.loading.set(false)
			},
		})
	}

	openCreate() {
		this.createForm.reset({ sort_order: 0 })
		this.showCreate.set(true)
	}

	onAction(event: { action: string; item: Faq }) {
		if (event.action === 'edit') {
			this.editTarget = event.item
			this.editForm.patchValue({
				question: event.item.question,
				answer: event.item.answer,
				sort_order: event.item.sort_order,
				is_active: event.item.is_active,
			})
			this.showEdit.set(true)
		} else if (event.action === 'assignments') {
			this.assignmentsTarget.set(event.item)
			this.showAssignments.set(true)
		} else if (event.action === 'delete') {
			this.infoModal.openAsConfirm(
				() => this.doDelete(event.item),
				`¿Eliminar la FAQ "${event.item.question}"?`,
			)
		}
	}

	onCreate() {
		if (this.createForm.invalid) {
			this.toast.toast({ severity: 'warning', body: 'Completá los campos requeridos.' })
			return
		}
		const v = this.createForm.getRawValue()
		this.admin.createFaq({
			question: v.question!,
			answer: v.answer!,
			sort_order: Number(v.sort_order ?? 0),
		}).subscribe({
			next: res => {
				this.faqs.update(list => [...list, res.data])
				this.showCreate.set(false)
				this.toast.toast({ severity: 'success', body: 'FAQ creada.' })
			},
			error: err => {
				this.toast.toast({ severity: 'error', body: err.error?.error ?? 'Error al crear la FAQ.' })
			},
		})
	}

	onUpdate() {
		if (!this.editTarget) return
		const v = this.editForm.getRawValue()
		this.admin.updateFaq(this.editTarget.id, {
			question: v.question ?? undefined,
			answer: v.answer ?? undefined,
			sort_order: v.sort_order != null ? Number(v.sort_order) : undefined,
			is_active: v.is_active ?? undefined,
		}).subscribe({
			next: res => {
				this.faqs.update(list => list.map(f => (f.id === res.data.id ? res.data : f)))
				this.showEdit.set(false)
				this.editTarget = null
				this.toast.toast({ severity: 'success', body: 'FAQ actualizada.' })
			},
			error: err => {
				this.toast.toast({ severity: 'error', body: err.error?.error ?? 'Error al actualizar la FAQ.' })
			},
		})
	}

	private doDelete(faq: Faq) {
		this.admin.deleteFaq(faq.id).subscribe({
			next: () => {
				this.faqs.update(list => list.filter(f => f.id !== faq.id))
				this.toast.toast({ severity: 'success', body: 'FAQ eliminada.' })
			},
			error: () => {
				this.toast.toast({ severity: 'error', body: 'Error al eliminar la FAQ.' })
			},
		})
	}

	isServiceAssigned(serviceId: string): boolean {
		return this.assignmentsTarget()?.service_ids.includes(serviceId) ?? false
	}

	isPortalAssigned(portalId: string): boolean {
		return this.assignmentsTarget()?.portal_ids.includes(portalId) ?? false
	}

	onToggleService(serviceId: string, event: Event) {
		const faq = this.assignmentsTarget()
		if (!faq) return
		const checked = (event.target as HTMLInputElement).checked
		const call = checked
			? this.admin.assignFaqService(faq.id, serviceId)
			: this.admin.unassignFaqService(faq.id, serviceId)

		call.subscribe({
			next: () => this.updateFaqAssignments(faq.id, current => ({
				...current,
				service_ids: checked
					? [...current.service_ids, serviceId]
					: current.service_ids.filter(id => id !== serviceId),
			})),
			error: () => {
				this.toast.toast({ severity: 'error', body: 'Error al actualizar la asignación de servicio.' })
			},
		})
	}

	onTogglePortal(portalId: string, event: Event) {
		const faq = this.assignmentsTarget()
		if (!faq) return
		const checked = (event.target as HTMLInputElement).checked
		const call = checked
			? this.admin.assignFaqPortal(faq.id, portalId)
			: this.admin.unassignFaqPortal(faq.id, portalId)

		call.subscribe({
			next: () => this.updateFaqAssignments(faq.id, current => ({
				...current,
				portal_ids: checked
					? [...current.portal_ids, portalId]
					: current.portal_ids.filter(id => id !== portalId),
			})),
			error: () => {
				this.toast.toast({ severity: 'error', body: 'Error al actualizar la asignación de portal.' })
			},
		})
	}

	private updateFaqAssignments(faqId: string, update: (faq: Faq) => Faq) {
		this.faqs.update(list => list.map(f => (f.id === faqId ? update(f) : f)))
		this.assignmentsTarget.update(current => (current && current.id === faqId ? update(current) : current))
	}
}
