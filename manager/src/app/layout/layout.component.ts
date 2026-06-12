import { Component, computed, inject, signal, ViewEncapsulation } from '@angular/core'
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router'
import { DrawerBar } from '@germanmacchia/angular-ui'
import { AuthService } from '../core/services/auth.service'

@Component({
	selector: 'app-layout',
	standalone: true,
	imports: [RouterOutlet, RouterLink, RouterLinkActive, DrawerBar],
	encapsulation: ViewEncapsulation.None,
	template: `
		<div class="flex h-screen overflow-hidden">
			<lib-drawer-bar
				[title]="'Manager'"
				[themes]="themes"
				[logout]="logoutFn"
				[logoutLabel]="'Cerrar sesión'"
				[(drawerOpen)]="drawerOpen">
				<ul class="menu menu-sm w-full gap-1 p-2">
					<li>
						<a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
							<i class="bi bi-speedometer2"></i> Dashboard
						</a>
					</li>
					@if (isSuperAdmin()) {
						<li>
							<a routerLink="/tenants" routerLinkActive="active">
								<i class="bi bi-building"></i> Tenants
							</a>
						</li>
						<li>
							<a routerLink="/services" routerLinkActive="active">
								<i class="bi bi-grid"></i> Servicios
							</a>
						</li>
					}
				</ul>
			</lib-drawer-bar>

			<main class="flex-1 overflow-y-auto">
				<router-outlet />
			</main>
		</div>
	`,
})
export class LayoutComponent {
	protected auth = inject(AuthService)
	private router = inject(Router)

	isSuperAdmin = computed(() => this.auth.currentUser()?.role === 'superadmin')
	drawerOpen = signal(true)

	readonly themes = { dark: 'business', light: 'cupcake' }

	readonly logoutFn = () => {
		this.auth.clearTokens()
		this.router.navigate(['/login'])
	}
}
