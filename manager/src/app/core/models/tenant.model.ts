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
	price_usd: number
}

export interface Tenant {
	id: string
	slug: string
	name: string
	domain?: string | null
	plan_id: string
	plan?: Plan
	status: 'active' | 'suspended' | 'trial' | 'cancelled'
	trial_ends_at?: string | null
	created_at: string
	updated_at: string
}

export interface Service {
	id: string
	name: string
	slug: string
	mfe_url: string
	api_url?: string | null
	version: string
	description?: string | null
	is_active: boolean
	created_at: string
	updated_at: string
}

export interface TenantServiceEntry {
	id: string
	tenant_id: string
	service_id: string
	service?: Service
	is_enabled: boolean
	enabled_at: string
	expires_at?: string | null
}

export interface TenantUser {
	id: string
	tenant_id: string
	email: string
	role: 'superadmin' | 'admin' | 'member' | 'viewer'
	is_active: boolean
	last_login_at?: string | null
	created_at: string
	updated_at: string
}
