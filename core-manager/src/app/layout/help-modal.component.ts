import { Component, computed, EventEmitter, inject, Input, OnChanges, Output, signal, SimpleChanges } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { AdminService } from '../core/services/admin.service'
import { AuthService } from '../core/services/auth.service'
import { Faq, Portal, Service } from '../core/models/tenant.model'

@Component({
	selector: 'app-help-modal',
	standalone: true,
	imports: [FormsModule],
	template: `
		<dialog class="modal" [class.modal-open]="open">
			<div class="modal-box w-11/12 max-w-2xl flex flex-col p-0 max-h-[90vh]">
				<div class="px-6 py-4 border-b border-base-200">
					<h3 class="font-semibold text-lg">Ayuda</h3>
				</div>
				<div class="px-6 py-4 border-b border-base-200 grid grid-cols-1 md:grid-cols-2 gap-4">
					<label class="form-control">
						<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Filtrar por servicio</span></div>
						<select class="select select-bordered select-sm" [(ngModel)]="filterServiceId">
							<option value="">Todos</option>
							@for (service of services(); track service.id) {
								<option [value]="service.id">{{ service.name }}</option>
							}
						</select>
					</label>
					<label class="form-control">
						<div class="label pt-0 pb-2"><span class="label-text text-sm font-medium">Filtrar por portal</span></div>
						<select class="select select-bordered select-sm" [(ngModel)]="filterPortalId">
							<option value="">Todos</option>
							@for (portal of portals(); track portal.id) {
								<option [value]="portal.id">{{ portal.name }}</option>
							}
						</select>
					</label>
				</div>
				<div class="px-6 py-5 flex-1 overflow-y-auto">
					@if (loading()) {
						<p class="text-sm text-base-content/50">Cargando...</p>
					} @else if (!filteredFaqs().length) {
						<p class="text-sm text-base-content/50">No hay FAQs disponibles.</p>
					} @else {
						<div class="flex flex-col gap-2">
							@for (faq of filteredFaqs(); track faq.id) {
								<div class="collapse collapse-arrow bg-base-200">
									<input type="checkbox">
									<div class="collapse-title text-sm font-medium">{{ faq.question }}</div>
									<div class="collapse-content text-sm text-base-content/70">{{ faq.answer }}</div>
								</div>
							}
						</div>
					}
				</div>
				<div class="px-6 py-4 border-t border-base-200 flex justify-end gap-2">
					<button type="button" class="btn btn-ghost btn-sm" (click)="onClose()">Cerrar</button>
				</div>
			</div>
			<form method="dialog" class="modal-backdrop" (click)="onClose()"><button>close</button></form>
		</dialog>
	`,
})
export class HelpModalComponent implements OnChanges {
	private admin = inject(AdminService)
	private auth = inject(AuthService)

	@Input() open = false
	@Output() closed = new EventEmitter<void>()

	private loaded = false
	loading = signal(false)

	faqs = signal<Faq[]>([])
	services = signal<Service[]>([])
	portals = signal<Portal[]>([])

	filterServiceId = ''
	filterPortalId = ''

	filteredFaqs = computed(() => {
		const serviceId = this.filterServiceId
		const portalId = this.filterPortalId
		return this.faqs().filter(faq => {
			if (serviceId && !faq.service_ids.includes(serviceId)) return false
			if (portalId && !faq.portal_ids.includes(portalId)) return false
			return true
		})
	})

	ngOnChanges(changes: SimpleChanges) {
		if (changes['open']?.currentValue === true && !this.loaded) {
			this.loaded = true
			this.load()
		}
	}

	onClose() {
		this.closed.emit()
	}

	private load() {
		this.loading.set(true)
		this.admin.listFaqs(true).subscribe({
			next: res => {
				this.faqs.set(res.data ?? [])
				this.loading.set(false)
			},
			error: () => this.loading.set(false),
		})
		this.admin.listServices(true).subscribe({ next: res => this.services.set(res.data ?? []) })

		const tenantId = this.auth.currentUser()?.tenant_id
		if (tenantId) {
			this.admin.listPortals(tenantId).subscribe({ next: res => this.portals.set(res.data ?? []) })
		}
	}
}
