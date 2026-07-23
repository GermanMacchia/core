import { Injectable, inject } from '@angular/core'
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { AuthService } from './auth.service'
import {
	ApiResponse,
	Plan,
	PlanServicePricing,
	Tenant,
	Service,
	Portal,
	PortalService,
	TenantUser,
	ConfigDefinition,
} from '../models/tenant.model'

const CORE_API = 'http://localhost:8080'

@Injectable({ providedIn: 'root' })
export class AdminService {
	private http = inject(HttpClient)
	private auth = inject(AuthService)

	private get headers() {
		return new HttpHeaders({ Authorization: `Bearer ${this.auth.accessToken()}` })
	}

	// ── Plans ─────────────────────────────────────────────────────────────────

	listPlans() {
		return this.http.get<ApiResponse<Plan[]>>(`${CORE_API}/api/v1/plans`, {
			headers: this.headers,
		})
	}

	getPlan(id: string) {
		return this.http.get<ApiResponse<Plan>>(`${CORE_API}/api/v1/plans/${id}`, {
			headers: this.headers,
		})
	}

	createPlan(body: { name: string; max_users: number; max_services: number; price: number; features?: Record<string, unknown> }) {
		return this.http.post<ApiResponse<Plan>>(`${CORE_API}/api/v1/plans`, body, {
			headers: this.headers,
		})
	}

	updatePlan(
		id: string,
		body: { name?: string; max_users?: number; max_services?: number; price?: number; features?: Record<string, unknown> },
	) {
		return this.http.patch<ApiResponse<Plan>>(`${CORE_API}/api/v1/plans/${id}`, body, {
			headers: this.headers,
		})
	}

	deletePlan(id: string) {
		return this.http.delete(`${CORE_API}/api/v1/plans/${id}`, { headers: this.headers })
	}

	listPlanServicePricing(planId: string) {
		return this.http.get<ApiResponse<PlanServicePricing[]>>(
			`${CORE_API}/api/v1/plans/${planId}/services`,
			{ headers: this.headers },
		)
	}

	setPlanServicePricing(planId: string, serviceId: string, body: { price: number; is_included: boolean }) {
		return this.http.put<ApiResponse<PlanServicePricing>>(
			`${CORE_API}/api/v1/plans/${planId}/services/${serviceId}`,
			body,
			{ headers: this.headers },
		)
	}

	removePlanServicePricing(planId: string, serviceId: string) {
		return this.http.delete(
			`${CORE_API}/api/v1/plans/${planId}/services/${serviceId}`,
			{ headers: this.headers },
		)
	}

	// ── Tenants ───────────────────────────────────────────────────────────────

	listTenants(limit = 20, offset = 0) {
		return this.http.get<ApiResponse<Tenant[]>>(
			`${CORE_API}/api/v1/tenants?limit=${limit}&offset=${offset}`,
			{ headers: this.headers },
		)
	}

	createTenant(body: { name: string; domain?: string; plan_id: string }) {
		return this.http.post<ApiResponse<Tenant>>(`${CORE_API}/api/v1/tenants`, body, {
			headers: this.headers,
		})
	}

	getTenant(id: string) {
		return this.http.get<ApiResponse<Tenant>>(`${CORE_API}/api/v1/tenants/${id}`, {
			headers: this.headers,
		})
	}

	updateTenant(id: string, body: { name?: string; domain?: string; status?: string; config?: Record<string, unknown> }) {
		return this.http.patch<ApiResponse<Tenant>>(`${CORE_API}/api/v1/tenants/${id}`, body, {
			headers: this.headers,
		})
	}

	deleteTenant(id: string) {
		return this.http.delete(`${CORE_API}/api/v1/tenants/${id}`, { headers: this.headers })
	}

	// ── Portals ───────────────────────────────────────────────────────────────

	listPortals(tenantId: string) {
		return this.http.get<ApiResponse<Portal[]>>(
			`${CORE_API}/api/v1/tenants/${tenantId}/portals`,
			{ headers: this.headers },
		)
	}

	createPortal(tenantId: string, body: { name: string; domain?: string; description?: string; config?: Record<string, unknown> }) {
		return this.http.post<ApiResponse<Portal>>(
			`${CORE_API}/api/v1/tenants/${tenantId}/portals`,
			body,
			{ headers: this.headers },
		)
	}

	updatePortal(portalId: string, body: { name?: string; domain?: string; description?: string; is_active?: boolean; config?: Record<string, unknown> }) {
		return this.http.patch<ApiResponse<Portal>>(
			`${CORE_API}/api/v1/portals/${portalId}`,
			body,
			{ headers: this.headers },
		)
	}

	// ── Portal services ───────────────────────────────────────────────────────

	getPortalServices(portalId: string) {
		return this.http.get<ApiResponse<PortalService[]>>(
			`${CORE_API}/api/v1/portals/${portalId}/services`,
			{ headers: this.headers },
		)
	}

	assignPortalService(
		portalId: string,
		body: { service_id: string; slug: string; sort_order: number },
	) {
		return this.http.post<ApiResponse<PortalService>>(
			`${CORE_API}/api/v1/portals/${portalId}/services`,
			body,
			{ headers: this.headers },
		)
	}

	updatePortalService(
		portalId: string,
		serviceId: string,
		body: { slug?: string; sort_order?: number; config_override?: Record<string, unknown> },
	) {
		return this.http.patch<ApiResponse<PortalService>>(
			`${CORE_API}/api/v1/portals/${portalId}/services/${serviceId}`,
			body,
			{ headers: this.headers },
		)
	}

	unassignPortalService(portalId: string, serviceId: string) {
		return this.http.delete(
			`${CORE_API}/api/v1/portals/${portalId}/services/${serviceId}`,
			{ headers: this.headers },
		)
	}

	// ── Services catalog ──────────────────────────────────────────────────────

	listServices(all = true) {
		const params = all ? '?all=true' : ''
		return this.http.get<ApiResponse<Service[]>>(`${CORE_API}/api/v1/services${params}`, {
			headers: this.headers,
		})
	}

	createService(body: {
		name: string
		mfe_url: string
		description?: string
		version: string
		config?: Record<string, unknown>
	}) {
		return this.http.post<ApiResponse<Service>>(`${CORE_API}/api/v1/services`, body, {
			headers: this.headers,
		})
	}

	getService(id: string) {
		return this.http.get<ApiResponse<Service>>(`${CORE_API}/api/v1/services/${id}`, {
			headers: this.headers,
		})
	}

	updateService(
		id: string,
		body: {
			name?: string
			mfe_url?: string
			version?: string
			description?: string
			is_active?: boolean
			config?: Record<string, unknown>
		},
	) {
		return this.http.patch<ApiResponse<Service>>(`${CORE_API}/api/v1/services/${id}`, body, {
			headers: this.headers,
		})
	}

	deleteService(id: string) {
		return this.http.delete(`${CORE_API}/api/v1/services/${id}`, { headers: this.headers })
	}

	// ── Tenant users ──────────────────────────────────────────────────────────

	getTenantUsers(tenantId: string) {
		return this.http.get<ApiResponse<TenantUser[]>>(
			`${CORE_API}/api/v1/tenants/${tenantId}/users`,
			{ headers: this.headers },
		)
	}

	createTenantUser(tenantId: string, body: { email: string; password: string; role: string; portal_id?: string }) {
		return this.http.post<ApiResponse<TenantUser>>(
			`${CORE_API}/api/v1/tenants/${tenantId}/users`,
			body,
			{ headers: this.headers },
		)
	}

	updateTenantUser(tenantId: string, userId: string, body: { role?: string; is_active?: boolean; portal_id?: string }) {
		return this.http.patch<ApiResponse<TenantUser>>(
			`${CORE_API}/api/v1/tenants/${tenantId}/users/${userId}`,
			body,
			{ headers: this.headers },
		)
	}

	deleteTenantUser(tenantId: string, userId: string) {
		return this.http.delete(`${CORE_API}/api/v1/tenants/${tenantId}/users/${userId}`, {
			headers: this.headers,
		})
	}

	// ── Config Definitions ──────────────────────────────────────────────────

	listConfigDefinitions() {
		return this.http.get<ApiResponse<ConfigDefinition[]>>(`${CORE_API}/api/v1/config-definitions`, {
			headers: this.headers,
		})
	}

	createConfigDefinition(body: {
		key: string
		scope: string
		type: string
		description?: string | null
		default_val?: string | null
	}) {
		return this.http.post<ApiResponse<ConfigDefinition>>(`${CORE_API}/api/v1/config-definitions`, body, {
			headers: this.headers,
		})
	}

	updateConfigDefinition(
		scope: string,
		key: string,
		body: {
			type?: string
			description?: string | null
			default_val?: string | null
		},
	) {
		return this.http.patch<ApiResponse<ConfigDefinition>>(
			`${CORE_API}/api/v1/config-definitions/${scope}/${key}`,
			body,
			{ headers: this.headers },
		)
	}

	deleteConfigDefinition(scope: string, key: string) {
		return this.http.delete(`${CORE_API}/api/v1/config-definitions/${scope}/${key}`, {
			headers: this.headers,
		})
	}

	resetCache() {
		return this.http.post<ApiResponse<{ message: string }>>(`${CORE_API}/api/v1/cache/reset`, {}, {
			headers: this.headers,
		})
	}
}
