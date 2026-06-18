export interface MfeEntry {
	slug: string
	mfe_url: string
	public: boolean
}

export interface TenantMeta {
	slug: string
	name: string
	logo_url?: string
	primary_color?: string
}

export interface TenantConfig {
	tenant: TenantMeta
	auth_mfe_url: string
	auth_api_url?: string
	mfes: MfeEntry[]
}

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
	domain?: string | null
	plan_id: string
	plan?: Plan
	status: 'active' | 'suspended' | 'trial' | 'cancelled'
	config: Record<string, unknown>
	trial_ends_at?: string | null
	created_at: string
	updated_at: string
}

export interface Service {
	id: string
	name: string
	mfe_url: string
	version: string
	description?: string | null
	config: Record<string, unknown>
	is_active: boolean
	created_at: string
	updated_at: string
}

export interface Portal {
	id: string
	tenant_id: string
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
	config: Record<string, unknown>
	sort_order: number
}

export interface TenantUser {
	id: string
	tenant_id: string
	portal_id?: string | null
	email: string
	role: 'superadmin' | 'admin' | 'member' | 'viewer'
	is_active: boolean
	last_login_at?: string | null
	created_at: string
	updated_at: string
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
