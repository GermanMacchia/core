import { Injectable, inject } from '@angular/core'
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { AuthService } from './auth.service'
import {
	ApiResponse,
	Tenant,
	Service,
	TenantServiceEntry,
	TenantUser,
} from '../models/tenant.model'

const CORE_API = 'http://localhost:8080'

@Injectable({ providedIn: 'root' })
export class AdminService {
	private http = inject(HttpClient)
	private auth = inject(AuthService)

	private get headers() {
		return new HttpHeaders({ Authorization: `Bearer ${this.auth.accessToken()}` })
	}

	listTenants(limit = 20, offset = 0) {
		return this.http.get<ApiResponse<Tenant[]>>(
			`${CORE_API}/api/v1/tenants?limit=${limit}&offset=${offset}`,
			{ headers: this.headers },
		)
	}

	createTenant(body: { slug: string; name: string; domain?: string; plan_id: string }) {
		return this.http.post<ApiResponse<Tenant>>(`${CORE_API}/api/v1/tenants`, body, {
			headers: this.headers,
		})
	}

	getTenant(id: string) {
		return this.http.get<ApiResponse<Tenant>>(`${CORE_API}/api/v1/tenants/${id}`, {
			headers: this.headers,
		})
	}

	updateTenant(id: string, body: { name?: string; domain?: string; status?: string }) {
		return this.http.patch<ApiResponse<Tenant>>(`${CORE_API}/api/v1/tenants/${id}`, body, {
			headers: this.headers,
		})
	}

	deleteTenant(id: string) {
		return this.http.delete(`${CORE_API}/api/v1/tenants/${id}`, { headers: this.headers })
	}

	listServices(all = true) {
		const params = all ? '?all=true' : ''
		return this.http.get<ApiResponse<Service[]>>(`${CORE_API}/api/v1/services${params}`, {
			headers: this.headers,
		})
	}

	createService(body: {
		name: string
		slug: string
		mfe_url: string
		api_url?: string
		description?: string
		version: string
	}) {
		return this.http.post<ApiResponse<Service>>(`${CORE_API}/api/v1/services`, body, {
			headers: this.headers,
		})
	}

	getTenantServices(tenantId: string) {
		return this.http.get<ApiResponse<TenantServiceEntry[]>>(
			`${CORE_API}/api/v1/tenants/${tenantId}/services`,
			{ headers: this.headers },
		)
	}

	enableService(tenantId: string, serviceId: string) {
		return this.http.post<ApiResponse<TenantServiceEntry>>(
			`${CORE_API}/api/v1/tenants/${tenantId}/services`,
			{ service_id: serviceId },
			{ headers: this.headers },
		)
	}

	disableService(tenantId: string, serviceId: string) {
		return this.http.delete(`${CORE_API}/api/v1/tenants/${tenantId}/services/${serviceId}`, {
			headers: this.headers,
		})
	}

	getTenantUsers(tenantId: string) {
		return this.http.get<ApiResponse<TenantUser[]>>(
			`${CORE_API}/api/v1/tenants/${tenantId}/users`,
			{ headers: this.headers },
		)
	}

	createTenantUser(tenantId: string, body: { email: string; password: string; role: string }) {
		return this.http.post<ApiResponse<TenantUser>>(
			`${CORE_API}/api/v1/tenants/${tenantId}/users`,
			body,
			{ headers: this.headers },
		)
	}

	updateTenantUser(tenantId: string, userId: string, body: { role?: string; is_active?: boolean }) {
		return this.http.patch<ApiResponse<TenantUser>>(
			`${CORE_API}/api/v1/tenants/${tenantId}/users/${userId}`,
			body,
			{ headers: this.headers },
		)
	}

	deleteTenantUser(tenantId: string, userId: string) {
		return this.http.delete(
			`${CORE_API}/api/v1/tenants/${tenantId}/users/${userId}`,
			{ headers: this.headers },
		)
	}

	getService(id: string) {
		return this.http.get<ApiResponse<Service>>(`${CORE_API}/api/v1/services/${id}`, {
			headers: this.headers,
		})
	}

	updateService(id: string, body: { name?: string; mfe_url?: string; api_url?: string; version?: string; description?: string; is_active?: boolean }) {
		return this.http.patch<ApiResponse<Service>>(`${CORE_API}/api/v1/services/${id}`, body, {
			headers: this.headers,
		})
	}

	deleteService(id: string) {
		return this.http.delete(`${CORE_API}/api/v1/services/${id}`, { headers: this.headers })
	}
}
