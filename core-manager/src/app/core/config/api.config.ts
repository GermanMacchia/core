// Base URL of core-backend. Set VITE_CORE_API_URL in .env for each deploy;
// the localhost fallback only keeps local development working out of the box.
export const CORE_API_URL: string = import.meta.env.VITE_CORE_API_URL || 'http://localhost:8080'

// Base URL of core-authenticator, same fallback rule as CORE_API_URL.
const AUTH_API_URL: string = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:8081'

// Inside the shell, the URL it injects through the shell context wins.
export function authApiUrl(): string {
	return window.__SHELL_CONTEXT__?.authApiUrl ?? AUTH_API_URL
}
