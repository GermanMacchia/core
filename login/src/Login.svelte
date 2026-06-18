<svelte:options customElement="login-mfe" />

<script lang="ts">
	export let config: string = '{}';

	// ── Tipos ────────────────────────────────────────────────────────────
	interface Cfg {
		name?: string;
		logo_url?: string;
		primary_color?: string;
		auth_url?: string;
	}

	// ── Config reactiva ──────────────────────────────────────────────────
	$: cfg = parseCfg(config);
	$: name = cfg.name ?? 'Platform';
	$: logoUrl = cfg.logo_url || new URL('/brand-logo-colored.svg', import.meta.url).href;
	$: primary = cfg.primary_color ?? '#6366f1';
	$: authUrl = (cfg.auth_url ?? 'http://localhost:8081').replace(/\/$/, '');

	function parseCfg(raw: string): Cfg {
		try {
			return JSON.parse(raw) as Cfg;
		} catch {
			return {};
		}
	}

	// ── Estado del formulario ────────────────────────────────────────────
	let email = '';
	let password = '';
	let showPassword = false;
	let loading = false;
	let errorMsg = '';

	// ── Referencia al contenedor (para emitir eventos cross shadow-DOM) ──
	let wrapper: HTMLElement;

	function emit<T>(name: string, detail: T) {
		if (!wrapper) return;
		const root = wrapper.getRootNode();
		const host = root instanceof ShadowRoot ? (root.host as HTMLElement) : wrapper;
		host.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
	}

	// ── Submit ───────────────────────────────────────────────────────────
	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		errorMsg = '';

		if (!email.trim() || !password) {
			errorMsg = 'Completá email y contraseña.';
			return;
		}

		loading = true;
		try {
			const res = await fetch(`${authUrl}/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: email.trim(), password }),
			});
			const body = await res.json();

			if (!res.ok) {
				errorMsg = body.error ?? 'Credenciales incorrectas';
				emit('loginerror', { message: errorMsg, status: res.status });
				return;
			}

			emit('loginsuccess', body.data ?? body);
		} catch {
			errorMsg = 'No se pudo conectar con el servidor de autenticación.';
			emit('loginerror', { message: errorMsg });
		} finally {
			loading = false;
		}
	}
</script>

<!-- ──────────────────── markup ──────────────────── -->
<div bind:this={wrapper} class="root" style="--primary:{primary};--primary-20:{primary}33">
	<div class="card">
		<!-- Logo / ícono -->
		{#if logoUrl}
			<img src={logoUrl} alt={name} class="logo-img" />
		{:else}
			<div class="logo-icon" style="background:linear-gradient(135deg,{primary},{primary}99)">
				<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8">
					<path d="M12 2L2 7l10 5 10-5-10-5z" />
					<path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
				</svg>
			</div>
		{/if}

		<h1 class="title">Bienvenido</h1>
		<p class="subtitle">Ingresá a <strong>{name}</strong></p>

		<form on:submit={handleSubmit} novalidate>
			<!-- Email -->
			<div class="field">
				<label for="lm-email">Email</label>
				<div class="input-wrap">
					<svg
						class="icon"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<path
							d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
						/>
					</svg>
					<input
						id="lm-email"
						type="email"
						bind:value={email}
						placeholder="tu@email.com"
						autocomplete="email"
						disabled={loading}
						required
					/>
				</div>
			</div>

			<!-- Password -->
			<div class="field">
				<label for="lm-pass">Contraseña</label>
				<div class="input-wrap">
					<svg
						class="icon"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<path
							d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
						/>
					</svg>
					<input
						id="lm-pass"
						type={showPassword ? 'text' : 'password'}
						bind:value={password}
						placeholder="Tu contraseña"
						autocomplete="current-password"
						disabled={loading}
						required
					/>
					<button
						type="button"
						class="eye"
						on:click={() => (showPassword = !showPassword)}
						aria-label={showPassword ? 'Ocultar' : 'Mostrar'}
					>
						{#if showPassword}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
								<path
									d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
								/>
							</svg>
						{:else}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
								<path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
								<path
									d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
								/>
							</svg>
						{/if}
					</button>
				</div>
			</div>

			<!-- Error -->
			{#if errorMsg}
				<div class="error-box" role="alert">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
						<path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span>{errorMsg}</span>
				</div>
			{/if}

			<!-- Submit -->
			<button type="submit" class="btn-submit" disabled={loading} style="background:{primary}">
				{#if loading}
					<svg class="spin" viewBox="0 0 24 24" fill="none">
						<circle
							cx="12"
							cy="12"
							r="10"
							stroke="white"
							stroke-width="3"
							stroke-dasharray="25 75"
							stroke-linecap="round"
						/>
					</svg>
					Verificando...
				{:else}
					Iniciar sesión
				{/if}
			</button>
		</form>
	</div>
</div>

<!-- ──────────────────── estilos (shadow DOM) ──────────────────── -->
<style>
	:host {
		display: block;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		-webkit-font-smoothing: antialiased;
	}

	*,
	*::before,
	*::after {
		box-sizing: border-box;
	}

	.root {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		background:
			radial-gradient(ellipse at 60% 0%, var(--primary-20, #6366f133) 0%, transparent 60%),
			linear-gradient(180deg, #f8fafc 0%, #e9eef5 100%);
	}

	/* ── Card ── */
	.card {
		width: 100%;
		max-width: 420px;
		background: #fff;
		border-radius: 1.5rem;
		padding: 2.5rem 2rem 2rem;
		box-shadow:
			0 0 0 1px rgba(0, 0, 0, 0.04),
			0 4px 6px rgba(0, 0, 0, 0.04),
			0 24px 60px rgba(0, 0, 0, 0.08);
		display: flex;
		flex-direction: column;
		align-items: center;
		animation: fadeUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes fadeUp {
		from {
			opacity: 0;
			transform: translateY(16px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* ── Logo ── */
	.logo-img {
		width: 200px;
		height: 200px;
		object-fit: contain;
		border-radius: 0.875rem;
		margin-bottom: 0.5rem;
		transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.logo-img:hover {
		transform: scale(1.08) rotate(2deg);
	}

	.logo-icon {
		width: 56px;
		height: 56px;
		border-radius: 0.875rem;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 0.5rem;
		box-shadow: 0 4px 14px var(--primary-20, rgba(99, 102, 241, 0.25));
	}

	.logo-icon svg {
		width: 26px;
		height: 26px;
	}

	/* ── Títulos ── */
	.title {
		font-size: 1.5rem;
		font-weight: 700;
		color: #0f172a;
		margin: 0.75rem 0 0;
		letter-spacing: -0.025em;
	}

	.subtitle {
		font-size: 0.875rem;
		color: #64748b;
		margin: 0.375rem 0 1.75rem;
	}

	.subtitle strong {
		color: var(--primary);
		font-weight: 600;
	}

	/* ── Formulario ── */
	form {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	label {
		font-size: 0.8rem;
		font-weight: 600;
		color: #374151;
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}

	.input-wrap {
		position: relative;
		display: flex;
		align-items: center;
	}

	.icon {
		position: absolute;
		left: 0.875rem;
		width: 1rem;
		height: 1rem;
		color: #9ca3af;
		pointer-events: none;
	}

	input {
		width: 100%;
		padding: 0.75rem 0.875rem 0.75rem 2.5rem;
		border: 1.5px solid #e2e8f0;
		border-radius: 0.75rem;
		font-size: 0.9375rem;
		color: #0f172a;
		background: #f8fafc;
		outline: none;
		transition:
			border-color 0.15s,
			box-shadow 0.15s,
			background 0.15s;
		-webkit-appearance: none;
	}

	input:focus {
		border-color: var(--primary);
		background: #fff;
		box-shadow: 0 0 0 3px var(--primary-20, rgba(99, 102, 241, 0.15));
	}

	input:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.eye {
		position: absolute;
		right: 0.75rem;
		background: none;
		border: none;
		cursor: pointer;
		color: #94a3b8;
		padding: 0.25rem;
		border-radius: 0.375rem;
		display: flex;
		align-items: center;
		transition: color 0.15s;
	}

	.eye:hover {
		color: #475569;
	}
	.eye svg {
		width: 1.125rem;
		height: 1.125rem;
	}

	/* ── Error ── */
	.error-box {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 0.75rem;
		color: #dc2626;
		font-size: 0.875rem;
		animation: shake 0.3s cubic-bezier(0.36, 0.07, 0.19, 0.97);
	}

	@keyframes shake {
		0%,
		100% {
			transform: translateX(0);
		}
		20% {
			transform: translateX(-6px);
		}
		60% {
			transform: translateX(6px);
		}
	}

	.error-box svg {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
	}

	/* ── Botón ── */
	.btn-submit {
		width: 100%;
		margin-top: 0.25rem;
		padding: 0.875rem;
		color: #fff;
		border: none;
		border-radius: 0.75rem;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		letter-spacing: 0.01em;
		transition:
			filter 0.15s,
			transform 0.1s,
			opacity 0.15s;
		box-shadow: 0 4px 14px var(--primary-20, rgba(99, 102, 241, 0.35));
	}

	.btn-submit:hover:not(:disabled) {
		filter: brightness(1.08);
		transform: translateY(-1px);
	}
	.btn-submit:active:not(:disabled) {
		transform: translateY(0);
		filter: brightness(0.95);
	}
	.btn-submit:disabled {
		opacity: 0.65;
		cursor: not-allowed;
		box-shadow: none;
	}

	/* ── Spinner ── */
	.spin {
		width: 1.125rem;
		height: 1.125rem;
		animation: rot 0.7s linear infinite;
	}

	@keyframes rot {
		to {
			transform: rotate(360deg);
		}
	}
</style>
