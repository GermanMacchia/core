import { Component, computed, inject, Input, OnInit, signal } from '@angular/core'
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms'
import { RouterLink } from '@angular/router'
import type {
	CompactListAction,
	CompactListColumn,
	FormField,
	InfoCardData,
} from '@germanmacchia/angular-ui'
import {
	CompactList,
	Form,
	InfoCard,
	InfoModalService,
	ToastService,
} from '@germanmacchia/angular-ui'
import { ConfigDefinition, Plan, PlanServicePricing, Service } from '../../core/models/tenant.model'
import { AdminService } from '../../core/services/admin.service'
import { ConfigEditorComponent } from '../../shared/config-editor.component'
import { buildConfigFromValues, defaultConfigValues, existingConfigToValues } from '../../shared/config-fields'

type Tab = 'overview' | 'addons'

@Component({
	selector: 'app-plan-detail',
	standalone: true,
	imports: [RouterLink, CompactList, Form, InfoCard, ReactiveFormsModule, ConfigEditorComponent],
	template: `
		<div class="p-6 lg:p-10">
			<div class="mb-2">
				<a routerLink="/plans" class="text-xs text-base-content/40 hover:text-base-content">
					<i class="bi bi-arrow-left"></i> Planes
				</a>
			</div>

			@if (loadingPlan()) {
				<div class="flex justify-center py-16">
					<span class="loading loading-spinner loading-md"></span>
				</div>
			} @else if (!plan()) {
				<div class="alert alert-error mt-4">No se encontró el plan.</div>
			} @else {
				<div class="flex items-start justify-between mb-6 gap-4 flex-wrap">
					<div>
						<h1 class="text-2xl font-bold text-base-content">{{ plan()!.name }}</h1>
						<p class="text-base-content/50 text-sm">{{ '$' + plan()!.price }} / mes</p>
					</div>
				</div>

				<div role="tablist" class="tabs tabs-border mb-6">
					@for (tab of tabs; track tab.id) {
						<a
							role="tab"
							class="tab"
							[class.tab-active]="activeTab() === tab.id"
							(click)="activeTab.set(tab.id)">
							<i [class]="tab.icon + ' mr-1.5'"></i>{{ tab.label }}
						</a>
					}
				</div>

				@if (activeTab() === 'overview') {
					<div class="flex flex-col gap-4 max-w-xl">
						<lib-info-card [data]="cardData()" />
						<div class="flex justify-end">
							<button class="btn btn-primary btn-sm" (click)="openEdit()">
								<i class="bi bi-pencil"></i> Editar
							</button>
						</div>
					</div>
				}

				@if (activeTab() === 'addons') {
					<div class="flex justify-end mb-4">
						<button class="btn btn-primary btn-sm" (click)="openAddService()">
							<i class="bi bi-plus-lg"></i> Agregar servicio
						</button>
					</div>
					<lib-compact-list
						[items]="pricing()"
						[columns]="pricingColumns"
						[actions]="pricingActions"
						[loading]="loadingPricing()"
						[emptyIcon]="'bi bi-boxes'"
						[emptyMessage]="'Sin servicios configurados en este plan'"
						[trackByKey]="'id'"
						(actionClick)="onPricingAction($event)">
					</lib-compact-list>
				}
			}
		</div>

		<!-- Edit Plan Modal -->
		<dialog class="modal" [class.modal-open]="showEdit()">
			<div class="modal-box w-11/12 max-w-lg flex flex-col p-0 max-h-[90vh]">
				<div class="px-6 py-4 border-b border-base-200">
					<h3 class="font-semibold text-lg">Editar plan</h3>
				</div>
				<form [formGroup]="editForm" class="flex flex-col overflow-hidden">
					<div class="px-6 py-5 flex-1 overflow-y-auto">
						<div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
							<label class="form-control md:col-span-2">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Nombre <span class="text-error text-xs">*</span></span></div>
								<input formControlName="name" type="text" class="input input-bordered">
							</label>
							<label class="form-control">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Máx. usuarios <span class="text-error text-xs">*</span></span></div>
								<input formControlName="max_users" type="number" class="input input-bordered">
							</label>
							<label class="form-control">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Máx. servicios <span class="text-error text-xs">*</span></span></div>
								<input formControlName="max_services" type="number" class="input input-bordered">
							</label>
							<label class="form-control md:col-span-2">
								<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Precio / mes <span class="text-error text-xs">*</span></span></div>
								<input formControlName="price" type="number" class="input input-bordered">
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

		<!-- Pricing Modal (sin config, usa lib-form) -->
		<lib-form
			[formGroup]="pricingForm"
			[fields]="pricingFormFields()"
			[displayMode]="'modal'"
			[title]="editPricingTarget() ? 'Editar servicio' : 'Agregar servicio'"
			[isOpen]="showPricingForm()"
			(submitEvent)="onSavePricing()"
			(cancelEvent)="showPricingForm.set(false)" />
	`,
})
export class PlanDetailComponent implements OnInit {
	@Input() id!: string

	private admin = inject(AdminService)
	private fb = inject(FormBuilder)
	private toast = inject(ToastService)
	private infoModal = inject(InfoModalService)

	activeTab = signal<Tab>('overview')
	tabs = [
		{ id: 'overview' as Tab, label: 'General', icon: 'bi bi-info-circle' },
		{ id: 'addons' as Tab, label: 'Add-ons', icon: 'bi bi-boxes' },
	]

	plan = signal<Plan | null>(null)
	loadingPlan = signal(true)
	showEdit = signal(false)

	configDefs = signal<ConfigDefinition[]>([])
	editConfigValues = signal<Record<string, string>>({})

	editForm = this.fb.group({
		name: ['', Validators.required],
		max_users: [0, Validators.required],
		max_services: [0, Validators.required],
		price: [0, [Validators.required, Validators.min(0)]],
	})

	cardData = computed<InfoCardData>(() => {
		const p = this.plan()
		if (!p) return { title: '', sections: [] }
		const featCount = Object.keys(p.features ?? {}).length
		return {
			title: p.name,
			titleIcon: 'bi bi-credit-card',
			layout: 'grid',
			gridCols: 2,
			sections: [
				{ name: 'Precio', content: `$${p.price} / mes`, icon: 'bi bi-cash' },
				{ name: 'Máx. usuarios', content: p.max_users === -1 ? 'Ilimitado' : String(p.max_users), icon: 'bi bi-people' },
				{ name: 'Máx. servicios', content: p.max_services === -1 ? 'Ilimitado' : String(p.max_services), icon: 'bi bi-grid' },
				{ name: 'Features', content: featCount ? `${featCount} configuradas` : '—', icon: 'bi bi-toggles' },
				{ name: 'Creado', content: this.fmtDate(p.created_at), icon: 'bi bi-calendar' },
			],
		}
	})

	pricing = signal<PlanServicePricing[]>([])
	loadingPricing = signal(false)
	showPricingForm = signal(false)
	editPricingTarget = signal<PlanServicePricing | null>(null)
	catalog = signal<Service[]>([])

	pricingForm = this.fb.group({
		service_id: ['', Validators.required],
		price: [0, [Validators.required, Validators.min(0)]],
		is_included: [false],
	})

	pricingFormFields = computed<FormField[]>(() => {
		const isEdit = !!this.editPricingTarget()
		const fields: FormField[] = []
		if (!isEdit) {
			const usedIds = new Set(this.pricing().map(p => p.service_id))
			fields.push({
				name: 'service_id',
				label: 'Servicio',
				type: 'select',
				required: true,
				options: this.catalog().filter(s => !usedIds.has(s.id)).map(s => ({ label: s.name, value: s.id })),
			})
		}
		fields.push(
			{
				name: 'is_included',
				label: 'Tipo',
				type: 'select',
				options: [
					{ label: 'Incluido en el plan', value: true },
					{ label: 'Add-on (precio adicional)', value: false },
				],
			},
			{ name: 'price', label: 'Precio adicional', type: 'text', placeholder: '0' },
		)
		return fields
	})

	pricingColumns: CompactListColumn<PlanServicePricing>[] = [
		{ key: 'service', header: 'Servicio', type: 'text', transform: (p: PlanServicePricing) => p.service?.name ?? '—' },
		{ key: 'is_included', header: 'Tipo', type: 'badge', transform: (p: PlanServicePricing) => p.is_included ? 'Incluido' : 'Add-on' },
		{ key: 'price', header: 'Precio adicional', type: 'text', transform: (p: PlanServicePricing) => p.is_included ? '—' : `$${p.price}` },
	]

	pricingActions: CompactListAction<PlanServicePricing>[] = [
		{ id: 'edit', icon: 'bi bi-pencil', tooltip: 'Editar' },
		{ id: 'remove', icon: 'bi bi-trash', tooltip: 'Quitar', class: 'text-error' },
	]

	ngOnInit() {
		this.loadPlan()
		this.loadPricing()
		this.loadCatalog()
		this.loadConfigDefs()
	}

	loadPlan() {
		this.loadingPlan.set(true)
		this.admin.getPlan(this.id).subscribe({
			next: res => { this.plan.set(res.data); this.loadingPlan.set(false) },
			error: () => this.loadingPlan.set(false),
		})
	}

	loadConfigDefs() {
		this.admin.listConfigDefinitions().subscribe({
			next: res => {
				const defs = (res.data ?? []).filter(d => d.scope === 'plan')
				this.configDefs.set(defs)
				this.editConfigValues.set(defaultConfigValues(defs))
			},
		})
	}

	openEdit() {
		const p = this.plan()
		if (!p) return
		this.editForm.patchValue({ name: p.name, max_users: p.max_users, max_services: p.max_services, price: p.price })
		this.editConfigValues.set(existingConfigToValues(p.features ?? {}, this.configDefs()))
		this.showEdit.set(true)
	}

	onUpdate() {
		if (this.editForm.invalid) {
			this.toast.toast({ severity: 'warning', body: 'Completá los campos requeridos.' })
			return
		}
		const v = this.editForm.getRawValue()
		this.admin.updatePlan(this.id, {
			name: v.name!,
			max_users: Number(v.max_users),
			max_services: Number(v.max_services),
			price: Number(v.price),
			features: buildConfigFromValues(this.editConfigValues(), this.configDefs()),
		}).subscribe({
			next: res => {
				this.plan.set(res.data)
				this.showEdit.set(false)
				this.toast.toast({ severity: 'success', body: 'Plan actualizado.' })
			},
			error: err => {
				this.toast.toast({ severity: 'error', body: err.error?.error ?? 'Error al actualizar.' })
			},
		})
	}

	loadPricing() {
		this.loadingPricing.set(true)
		this.admin.listPlanServicePricing(this.id).subscribe({
			next: res => { this.pricing.set(res.data ?? []); this.loadingPricing.set(false) },
			error: () => this.loadingPricing.set(false),
		})
	}

	loadCatalog() {
		this.admin.listServices(true).subscribe({ next: res => this.catalog.set(res.data ?? []) })
	}

	openAddService() {
		this.editPricingTarget.set(null)
		this.pricingForm.reset({ price: 0, is_included: false })
		this.showPricingForm.set(true)
	}

	onPricingAction(event: { action: string; item: PlanServicePricing }) {
		if (event.action === 'edit') {
			this.editPricingTarget.set(event.item)
			this.pricingForm.patchValue({ service_id: event.item.service_id, price: event.item.price, is_included: event.item.is_included })
			this.showPricingForm.set(true)
		} else if (event.action === 'remove') {
			this.infoModal.openAsConfirm(
				() => this.doRemove(event.item),
				`¿Quitar "${event.item.service?.name ?? 'este servicio'}" del plan?`,
			)
		}
	}

	onSavePricing() {
		const v = this.pricingForm.getRawValue()
		const target = this.editPricingTarget()
		const serviceId = target ? target.service_id : v.service_id!
		if (!serviceId) {
			this.toast.toast({ severity: 'warning', body: 'Seleccioná un servicio.' })
			return
		}
		this.admin.setPlanServicePricing(this.id, serviceId, {
			price: Number(v.price ?? 0),
			is_included: !!v.is_included,
		}).subscribe({
			next: res => {
				this.pricing.update(list => {
					const idx = list.findIndex(p => p.service_id === res.data.service_id)
					return idx >= 0 ? list.map((p, i) => (i === idx ? res.data : p)) : [...list, res.data]
				})
				this.showPricingForm.set(false)
				this.editPricingTarget.set(null)
				this.toast.toast({ severity: 'success', body: 'Servicio actualizado en el plan.' })
			},
			error: err => {
				this.toast.toast({ severity: 'error', body: err.error?.error ?? 'Error al guardar.' })
			},
		})
	}

	private doRemove(item: PlanServicePricing) {
		this.admin.removePlanServicePricing(this.id, item.service_id).subscribe({
			next: () => {
				this.pricing.update(list => list.filter(p => p.service_id !== item.service_id))
				this.toast.toast({ severity: 'success', body: 'Servicio quitado del plan.' })
			},
			error: () => {
				this.toast.toast({ severity: 'error', body: 'Error al quitar el servicio.' })
			},
		})
	}

	fmtDate(iso: string) {
		return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
	}
}
