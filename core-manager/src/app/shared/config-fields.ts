import type { ConfigDefinition } from '../core/models/tenant.model'

export function buildConfigFromValues(
	values: Record<string, string>,
	defs: ConfigDefinition[],
): Record<string, unknown> {
	const result: Record<string, unknown> = {}
	for (const def of defs) {
		const raw = values[def.key]
		if (raw === null || raw === undefined || raw === '') continue
		if (def.type === 'bool') result[def.key] = raw === 'true'
		else if (def.type === 'string[]') result[def.key] = raw.split(',').map((s: string) => s.trim()).filter(Boolean)
		else result[def.key] = raw
	}
	return result
}

export function existingConfigToValues(
	existingConfig: Record<string, unknown>,
	defs: ConfigDefinition[],
): Record<string, string> {
	const result: Record<string, string> = {}
	for (const def of defs) {
		const val = existingConfig?.[def.key]
		if (def.type === 'bool') {
			result[def.key] = val === true ? 'true' : val === false ? 'false' : (def.default_val ?? 'false')
		} else if (def.type === 'string[]') {
			result[def.key] = Array.isArray(val) ? (val as string[]).join(', ') : (def.default_val ?? '')
		} else {
			result[def.key] = val != null ? String(val) : (def.default_val ?? '')
		}
	}
	return result
}

export function defaultConfigValues(defs: ConfigDefinition[]): Record<string, string> {
	const result: Record<string, string> = {}
	for (const def of defs) {
		result[def.key] = def.default_val ?? (def.type === 'bool' ? 'false' : '')
	}
	return result
}
