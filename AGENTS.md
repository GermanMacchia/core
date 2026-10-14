# Code Review Rules

Scope: TypeScript/JavaScript in `core-manager` (Angular) and `core-login` (Svelte).
Go services (`core-backend`, `core-authenticator`) follow standard Go conventions and are not reviewed here.

## TypeScript

- Use `const`/`let`, never `var`
- No `any`; use `unknown` and narrow, or a proper type
- Prefer `interface` for object shapes; `type` for unions and aliases
- Use `import type` for type-only imports
- No non-null assertions (`!`) unless the invariant is obvious and local
- Style: single quotes, no semicolons, trailing commas in multiline literals
- No `console.log` left in committed code
- No hardcoded secrets, tokens, or environment URLs; read them from config

## Angular (core-manager)

- Standalone components only; no NgModules
- Use `inject()` instead of constructor injection
- Use signals (`signal`, `computed`) for component state; avoid manual subscriptions when a signal or `async` pipe works
- Unsubscribe from long-lived observables (`takeUntilDestroyed`)
- Use reactive forms (`FormBuilder`) with validators; no template-driven forms
- Reuse components from `@germanmacchia/angular-ui` before building new UI primitives
- HTTP calls live in `core/services`; components never call `HttpClient` directly
- Shared models live in `core/models`; do not redeclare DTO shapes inside components
- Container/presentational split: pages orchestrate data, shared components receive inputs and emit outputs
- Styling with Tailwind/DaisyUI utility classes; no inline `style` attributes
- UI copy stays in Spanish to match the existing app

## Svelte (core-login)

- TypeScript in every `<script lang="ts">` block
- Keep API calls out of components; use a dedicated module
- Never store tokens in `localStorage` without an explicit, documented reason

## Error Handling

- Every HTTP call handles errors and surfaces them to the user (toast or inline message)
- Never swallow errors with an empty `catch`
- Show loading state for async operations

## Security

- Never render untrusted HTML (`innerHTML`, `bypassSecurityTrust*`, `{@html}`) without sanitization
- Tenant and user IDs come from the authenticated context, never from user-editable input alone
