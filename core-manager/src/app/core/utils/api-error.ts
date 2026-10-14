import { HttpErrorResponse } from '@angular/common/http'

// Extracts the backend's `{ error: string }` message from a failed HTTP call,
// falling back to a caller-provided, user-facing message.
export function apiErrorMessage(err: unknown, fallback: string): string {
	if (err instanceof HttpErrorResponse) {
		const body: unknown = err.error
		if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string' && body.error) {
			return body.error
		}
	}
	return fallback
}
