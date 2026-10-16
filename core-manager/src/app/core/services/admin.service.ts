import { Injectable, inject } from '@angular/core'
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { AuthService } from './auth.service'
import type {
	ApiResponse,
	Plan,
	PlanServicePricing,
	Tenant,
	Service,
	Portal,
	PortalService,
	TenantService,
	TenantUser,
	ConfigDefinition,
	Faq,
	ServiceAccessGrant,
	RoleOption,
	ServiceInstance,
	Deployment,
	CreateDeploymentInput,
	UpdateDeploymentInput,
} from '../models/tenant.model'
import { CORE_API_URL as CORE_API } from '../config/api.config'

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

	listAllPortals() {
		return this.http.get<ApiResponse<Portal[]>>(`${CORE_API}/api/v1/portals`, {
			headers: this.headers,
		})
	}

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

	// ── Tenant services ──────────────────────────────────────────────────────

	listTenantServices(tenantId: string) {
		return this.http.get<ApiResponse<TenantService[]>>(
			`${CORE_API}/api/v1/tenants/${tenantId}/services`,
			{ headers: this.headers },
		)
	}

	assignTenantService(tenantId: string, body: { service_id: string }) {
		return this.http.post<ApiResponse<TenantService>>(
			`${CORE_API}/api/v1/tenants/${tenantId}/services`,
			body,
			{ headers: this.headers },
		)
	}

	unassignTenantService(tenantId: string, serviceId: string) {
		return this.http.delete(
			`${CORE_API}/api/v1/tenants/${tenantId}/services/${serviceId}`,
			{ headers: this.headers },
		)
	}

	updateTenantServiceInstance(tenantId: string, serviceId: string, body: { name?: string; slug?: string; config?: Record<string, unknown> }) {
		return this.http.patch<ApiResponse<ServiceInstance>>(
			`${CORE_API}/api/v1/tenants/${tenantId}/services/${serviceId}/instance`,
			body,
			{ headers: this.headers },
		)
	}

	// ── Deployments ───────────────────────────────────────────────────────────

	listDeployments(all = true) {
		const params = all ? '?all=true' : ''
		return this.http.get<ApiResponse<Deployment[]>>(`${CORE_API}/api/v1/deployments${params}`, {
			headers: this.headers,
		})
	}

	createDeployment(body: CreateDeploymentInput) {
		return this.http.post<ApiResponse<Deployment>>(`${CORE_API}/api/v1/deployments`, body, {
			headers: this.headers,
		})
	}

	updateDeployment(id: string, body: UpdateDeploymentInput) {
		return this.http.patch<ApiResponse<Deployment>>(`${CORE_API}/api/v1/deployments/${id}`, body, {
			headers: this.headers,
		})
	}

	deleteDeployment(id: string) {
		return this.http.delete(`${CORE_API}/api/v1/deployments/${id}`, { headers: this.headers })
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
		deployment_id: string
		description?: string
		config?: Record<string, unknown>
		requires_instance: boolean
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
			deployment_id?: string
			description?: string
			is_active?: boolean
			config?: Record<string, unknown>
			requires_instance?: boolean
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

	getTenantUsers(tenantId: string, includeInactive = false) {
		return this.http.get<ApiResponse<TenantUser[]>>(
			`${CORE_API}/api/v1/tenants/${tenantId}/users${includeInactive ? '?include_inactive=true' : ''}`,
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

	updateTenantUser(tenantId: string, userId: string, body: { role?: string; is_active?: boolean; portal_id?: string; restrict_services?: boolean; password?: string }) {
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

	// ── User service access grants ──────────────────────────────────────────

	listUserServiceAccess(tenantId: string, userId: string) {
		return this.http.get<ApiResponse<ServiceAccessGrant[]>>(
			`${CORE_API}/api/v1/tenants/${tenantId}/users/${userId}/service-access`,
			{ headers: this.headers },
		)
	}

	createUserServiceAccess(tenantId: string, userId: string, body: { service_instance_id: string; role_id: string }) {
		return this.http.post<ApiResponse<ServiceAccessGrant>>(
			`${CORE_API}/api/v1/tenants/${tenantId}/users/${userId}/service-access`,
			body,
			{ headers: this.headers },
		)
	}

	deleteUserServiceAccess(tenantId: string, userId: string, grantId: string) {
		return this.http.delete(
			`${CORE_API}/api/v1/tenants/${tenantId}/users/${userId}/service-access/${grantId}`,
			{ headers: this.headers },
		)
	}

	listRolesByService(serviceId: string) {
		return this.http.get<ApiResponse<RoleOption[]>>(
			`${CORE_API}/api/v1/services/${serviceId}/roles`,
			{ headers: this.headers },
		)
	}

	createRole(serviceId: string, body: { name: string; description?: string }) {
		return this.http.post<ApiResponse<RoleOption>>(
			`${CORE_API}/api/v1/services/${serviceId}/roles`,
			body,
			{ headers: this.headers },
		)
	}

	updateRole(roleId: string, body: { name?: string; description?: string }) {
		return this.http.patch<ApiResponse<RoleOption>>(
			`${CORE_API}/api/v1/roles/${roleId}`,
			body,
			{ headers: this.headers },
		)
	}

	deleteRole(roleId: string) {
		return this.http.delete(`${CORE_API}/api/v1/roles/${roleId}`, { headers: this.headers })
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

	// ── FAQs ──────────────────────────────────────────────────────────────────

	listFaqs(activeOnly = false) {
		const params = activeOnly ? '?active_only=true' : ''
		return this.http.get<ApiResponse<Faq[]>>(`${CORE_API}/api/v1/faqs${params}`, {
			headers: this.headers,
		})
	}

	createFaq(body: { question: string; answer: string; sort_order?: number }) {
		return this.http.post<ApiResponse<Faq>>(`${CORE_API}/api/v1/faqs`, body, {
			headers: this.headers,
		})
	}

	updateFaq(id: string, body: { question?: string; answer?: string; sort_order?: number; is_active?: boolean }) {
		return this.http.patch<ApiResponse<Faq>>(`${CORE_API}/api/v1/faqs/${id}`, body, {
			headers: this.headers,
		})
	}

	deleteFaq(id: string) {
		return this.http.delete(`${CORE_API}/api/v1/faqs/${id}`, { headers: this.headers })
	}

	assignFaqService(faqId: string, serviceId: string) {
		return this.http.post<ApiResponse<{ faq_id: string; service_id: string }>>(
			`${CORE_API}/api/v1/faqs/${faqId}/services`,
			{ service_id: serviceId },
			{ headers: this.headers },
		)
	}

	unassignFaqService(faqId: string, serviceId: string) {
		return this.http.delete(`${CORE_API}/api/v1/faqs/${faqId}/services/${serviceId}`, {
			headers: this.headers,
		})
	}

	assignFaqPortal(faqId: string, portalId: string) {
		return this.http.post<ApiResponse<{ faq_id: string; portal_id: string }>>(
			`${CORE_API}/api/v1/faqs/${faqId}/portals`,
			{ portal_id: portalId },
			{ headers: this.headers },
		)
	}

	unassignFaqPortal(faqId: string, portalId: string) {
		return this.http.delete(`${CORE_API}/api/v1/faqs/${faqId}/portals/${portalId}`, {
			headers: this.headers,
		})
	}
}
