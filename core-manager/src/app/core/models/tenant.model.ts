export interface AuthUser {
	id: string
	email: string
	role: string
	tenant_id: string
}

export interface AuthTokens {
	access_token: string
	refresh_token: string
	expires_at: string
	user: AuthUser
}

export interface ApiMeta {
	total: number
	limit: number
	offset: number
}

export interface ApiResponse<T> {
	data: T
	error?: string
	meta?: ApiMeta
}

export interface Plan {
	id: string
	name: string
	max_users: number
	max_services: number
	price: number
	features: Record<string, unknown>
	created_at: string
}

export interface Tenant {
	id: string
	name: string
	contact_email?: string | null
	contact_phone?: string | null
	address?: string | null
	// CUIT/CUIL stored as 11 digits, no dashes
	tax_id?: string | null
	plan_id: string
	plan?: Plan
	status: 'active' | 'suspended' | 'trial' | 'cancelled'
	config: Record<string, unknown>
	trial_ends_at?: string | null
	created_at: string
	updated_at: string
}

export interface CreateTenantInput {
	name: string
	plan_id: string
	contact_email?: string
	contact_phone?: string
	address?: string
	tax_id?: string
}

// Patch semantics: omitted fields are left unchanged; an empty string clears
// an optional contact field.
export interface UpdateTenantInput {
	name?: string
	contact_email?: string
	contact_phone?: string
	address?: string
	tax_id?: string
	status?: string
	config?: Record<string, unknown>
}

export interface Deployment {
	id: string
	name: string
	url: string
	api_url?: string | null
	version: string
	description?: string | null
	is_active: boolean
	created_at: string
	updated_at: string
}

export interface CreateDeploymentInput {
	name: string
	url: string
	api_url?: string | null
	version?: string
	description?: string | null
}

export interface UpdateDeploymentInput {
	name?: string
	url?: string
	api_url?: string | null
	version?: string
	description?: string | null
	is_active?: boolean
}

export interface Service {
	id: string
	name: string
	deployment_id: string
	deployment_name?: string
	// Resolved from the linked deployment (url / version)
	mfe_url: string
	version: string
	description?: string | null
	config: Record<string, unknown>
	is_active: boolean
	requires_instance: boolean
	created_at: string
	updated_at: string
}

export interface Portal {
	id: string
	tenant_id: string
	tenant_name?: string
	name: string
	domain?: string | null
	description?: string | null
	config: Record<string, unknown>
	is_active: boolean
	created_at: string
	updated_at: string
}

export interface PortalService {
	id: string // service_id serializado como "id" por el backend
	slug: string
	name: string
	mfe_url: string
	deployment_name: string
	config: Record<string, unknown>
	sort_order: number
}

export interface ServiceInstance {
	id: string
	name: string
	slug: string
	config: Record<string, unknown>
}

export interface TenantService {
	id: string // service_id serializado como "id" por el backend
	name: string
	mfe_url: string
	deployment_name: string
	is_enabled: boolean
	requires_instance: boolean
	instance?: ServiceInstance
}

export interface TenantUser {
	id: string
	tenant_id: string
	portal_id?: string | null
	email: string
	role: 'superadmin' | 'admin' | 'member' | 'viewer'
	is_active: boolean
	restrict_services: boolean
	last_login_at?: string | null
	created_at: string
	updated_at: string
}

export interface ServiceAccessGrant {
	id: string
	user_id: string
	service_instance_id: string
	service_instance_name: string
	service_id: string
	service_name: string
	role_id: string
	role_name: string
	created_at: string
}

export interface RoleOption {
	id: string
	name: string
	description?: string | null
	service_id: string
}

export interface PlanServicePricing {
	id: string
	plan_id: string
	service_id: string
	service?: Pick<Service, 'id' | 'name' | 'mfe_url' | 'version' | 'is_active'>
	price: number
	is_included: boolean
	created_at: string
}

export interface ConfigDefinition {
	id?: string // Client-side identifier (scope:key) for lists
	key: string
	scope: 'service' | 'portal' | 'tenant' | 'plan'
	type: 'bool' | 'string' | 'string[]'
	description?: string | null
	default_val?: string | null
}

export interface Faq {
	id: string
	question: string
	answer: string
	sort_order: number
	is_active: boolean
	service_ids: string[]
	portal_ids: string[]
	created_at: string
	updated_at: string
}

