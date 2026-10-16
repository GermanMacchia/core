// Client-side mirrors of the backend tenant contact validation
// (core-backend/internal/handler/tenant_validation.go).

// Digits, spaces, parentheses and dashes with an optional leading +, 6-30 chars,
// containing at least 6 digits.
export const PHONE_PATTERN = /^(?=(?:\D*\d){6})\+?[0-9 ()-]{6,30}$/

// CUIT/CUIL: 11 digits, dashes optional (XX-XXXXXXXX-X). The backend also
// validates the prefix and check digit.
export const CUIT_PATTERN = /^\d{2}-?\d{8}-?\d$/

export const ADDRESS_MAX_LENGTH = 500

// Formats an 11-digit CUIT/CUIL as XX-XXXXXXXX-X; returns '—' when empty.
export function formatCuit(value: string | null | undefined): string {
	if (!value) return '—'
	const digits = value.replace(/\D/g, '')
	if (digits.length !== 11) return value
	return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`
}

export function orDash(value: string | null | undefined): string {
	return value ? value : '—'
}
