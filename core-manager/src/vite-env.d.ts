/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_CORE_API_URL?: string
	readonly VITE_AUTH_API_URL?: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}

// Context shared with the single-spa shell (written by main.single-spa.ts).
interface ShellContext {
	authApiUrl?: string
	accessToken?: string
	serviceId?: string
}

interface Window {
	__SHELL_CONTEXT__?: ShellContext
}

declare module '*.css?inline' {
	const css: string
	export default css
}
