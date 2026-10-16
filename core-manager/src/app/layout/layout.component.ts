import {
	Component,
	computed,
	inject,
	OnDestroy,
	OnInit,
	signal,
	ViewEncapsulation,
} from '@angular/core'
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router'
import { DrawerBar, InfoModal } from '@germanmacchia/angular-ui'
import { AuthService } from '../core/services/auth.service'
import { HelpModalComponent } from './help-modal.component'

@Component({
	selector: 'app-layout',
	standalone: true,
	imports: [RouterOutlet, RouterLink, RouterLinkActive, DrawerBar, InfoModal, HelpModalComponent],
	encapsulation: ViewEncapsulation.None,
	template: `
		<div class="flex h-screen overflow-hidden">
			<lib-drawer-bar
				[title]="'Manager'"
				[themes]="themes"
				[logout]="logoutFn"
				[logoutLabel]="'Cerrar sesión'"
				[(drawerOpen)]="drawerOpen">
				<div class="flex flex-col h-full">
				<!-- Logo Container -->
				<div
					class="flex items-center ml-12 w-full py-4 border-b border-base-300/30 select-none transition-all duration-300 hover:bg-base-300/10 cursor-pointer"
					[class.px-4]="drawerOpen()"
					[class.px-2]="!drawerOpen()">
					<img
						[src]="logoUrl()"
						alt="Brand Logo"
						class="shrink-0 rounded-md transition-all duration-300 hover:scale-110 active:scale-95"
						[class.h-10]="!drawerOpen()"
						[class.w-10]="!drawerOpen()"
						[class.h-20]="drawerOpen()"
						[class.w-20]="drawerOpen()" />
				</div>

				<ul class="menu menu-sm w-full gap-1 p-2">
					<li>
						<a
							routerLink="/"
							routerLinkActive="active"
							[routerLinkActiveOptions]="{ exact: true }"
							class="flex flex-nowrap tooltip-right"
							[class.justify-start]="drawerOpen()"
							[class.justify-center]="!drawerOpen()"
							[class.pl-5]="drawerOpen()"
							[class.px-0]="!drawerOpen()"
							[class.gap-3]="drawerOpen()"
							[class.tooltip]="!drawerOpen()"
							[attr.data-tip]="!drawerOpen() ? 'Dashboard' : null">
							<div class="flex items-center justify-center min-w-6 w-6 shrink-0 text-lg">
								<i class="bi bi-speedometer2"></i>
							</div>
							@if (drawerOpen()) {
								<span class="font-medium truncate text-left">Dashboard</span>
							}
						</a>
					</li>
					@if (isSuperAdmin()) {
						<li>
							<a
								routerLink="/tenants"
								routerLinkActive="active"
								class="flex flex-nowrap tooltip-right"
								[class.justify-start]="drawerOpen()"
								[class.justify-center]="!drawerOpen()"
								[class.pl-5]="drawerOpen()"
								[class.px-0]="!drawerOpen()"
								[class.gap-3]="drawerOpen()"
								[class.tooltip]="!drawerOpen()"
								[attr.data-tip]="!drawerOpen() ? 'Tenants' : null">
								<div class="flex items-center justify-center min-w-6 w-6 shrink-0 text-lg">
									<i class="bi bi-building"></i>
								</div>
								@if (drawerOpen()) {
									<span class="font-medium truncate text-left">Tenants</span>
								}
							</a>
						</li>
						<li>
							<a
								routerLink="/deployments"
								routerLinkActive="active"
								class="flex flex-nowrap tooltip-right"
								[class.justify-start]="drawerOpen()"
								[class.justify-center]="!drawerOpen()"
								[class.pl-5]="drawerOpen()"
								[class.px-0]="!drawerOpen()"
								[class.gap-3]="drawerOpen()"
								[class.tooltip]="!drawerOpen()"
								[attr.data-tip]="!drawerOpen() ? 'Deploys' : null">
								<div class="flex items-center justify-center min-w-6 w-6 shrink-0 text-lg">
									<i class="bi bi-cloud-upload"></i>
								</div>
								@if (drawerOpen()) {
									<span class="font-medium truncate text-left">Deploys</span>
								}
							</a>
						</li>
						<li>
							<a
								routerLink="/services"
								routerLinkActive="active"
								class="flex flex-nowrap tooltip-right"
								[class.justify-start]="drawerOpen()"
								[class.justify-center]="!drawerOpen()"
								[class.pl-5]="drawerOpen()"
								[class.px-0]="!drawerOpen()"
								[class.gap-3]="drawerOpen()"
								[class.tooltip]="!drawerOpen()"
								[attr.data-tip]="!drawerOpen() ? 'Servicios' : null">
								<div class="flex items-center justify-center min-w-6 w-6 shrink-0 text-lg">
									<i class="bi bi-grid"></i>
								</div>
								@if (drawerOpen()) {
									<span class="font-medium truncate text-left">Servicios</span>
								}
							</a>
						</li>
						<li>
							<a
								routerLink="/portals"
								routerLinkActive="active"
								class="flex flex-nowrap tooltip-right"
								[class.justify-start]="drawerOpen()"
								[class.justify-center]="!drawerOpen()"
								[class.pl-5]="drawerOpen()"
								[class.px-0]="!drawerOpen()"
								[class.gap-3]="drawerOpen()"
								[class.tooltip]="!drawerOpen()"
								[attr.data-tip]="!drawerOpen() ? 'Portales' : null">
								<div class="flex items-center justify-center min-w-6 w-6 shrink-0 text-lg">
									<i class="bi bi-layout-three-columns"></i>
								</div>
								@if (drawerOpen()) {
									<span class="font-medium truncate text-left">Portales</span>
								}
							</a>
						</li>
						<li>
							<a
								routerLink="/plans"
								routerLinkActive="active"
								class="flex flex-nowrap tooltip-right"
								[class.justify-start]="drawerOpen()"
								[class.justify-center]="!drawerOpen()"
								[class.pl-5]="drawerOpen()"
								[class.px-0]="!drawerOpen()"
								[class.gap-3]="drawerOpen()"
								[class.tooltip]="!drawerOpen()"
								[attr.data-tip]="!drawerOpen() ? 'Planes' : null">
								<div class="flex items-center justify-center min-w-6 w-6 shrink-0 text-lg">
									<i class="bi bi-credit-card"></i>
								</div>
								@if (drawerOpen()) {
									<span class="font-medium truncate text-left">Planes</span>
								}
							</a>
						</li>
						<li>
							<a
								routerLink="/config-definitions"
								routerLinkActive="active"
								class="flex flex-nowrap tooltip-right"
								[class.justify-start]="drawerOpen()"
								[class.justify-center]="!drawerOpen()"
								[class.pl-5]="drawerOpen()"
								[class.px-0]="!drawerOpen()"
								[class.gap-3]="drawerOpen()"
								[class.tooltip]="!drawerOpen()"
								[attr.data-tip]="!drawerOpen() ? 'Configuraciones' : null">
								<div class="flex items-center justify-center min-w-6 w-6 shrink-0 text-lg">
									<i class="bi bi-sliders"></i>
								</div>
								@if (drawerOpen()) {
									<span class="font-medium truncate text-left">Configs</span>
								}
							</a>
						</li>
						<li>
							<a
								routerLink="/faqs"
								routerLinkActive="active"
								class="flex flex-nowrap tooltip-right"
								[class.justify-start]="drawerOpen()"
								[class.justify-center]="!drawerOpen()"
								[class.pl-5]="drawerOpen()"
								[class.px-0]="!drawerOpen()"
								[class.gap-3]="drawerOpen()"
								[class.tooltip]="!drawerOpen()"
								[attr.data-tip]="!drawerOpen() ? 'FAQs' : null">
								<div class="flex items-center justify-center min-w-6 w-6 shrink-0 text-lg">
									<i class="bi bi-patch-question"></i>
								</div>
								@if (drawerOpen()) {
									<span class="font-medium truncate text-left">FAQs</span>
								}
							</a>
						</li>
					}
				</ul>

				<ul class="menu menu-sm w-full gap-1 p-2 mt-auto">
					<li>
						<a
							class="flex flex-nowrap tooltip-right"
							[class.justify-start]="drawerOpen()"
							[class.justify-center]="!drawerOpen()"
							[class.pl-5]="drawerOpen()"
							[class.px-0]="!drawerOpen()"
							[class.gap-3]="drawerOpen()"
							[class.tooltip]="!drawerOpen()"
							[attr.data-tip]="!drawerOpen() ? 'Ayuda' : null"
							(click)="showHelp.set(true)">
							<div class="flex items-center justify-center min-w-6 w-6 shrink-0 text-lg">
								<i class="bi bi-question-circle"></i>
							</div>
							@if (drawerOpen()) {
								<span class="font-medium truncate text-left">Ayuda</span>
							}
						</a>
					</li>
				</ul>
				</div>
			</lib-drawer-bar>

			<main class="flex-1 overflow-y-auto">
				<router-outlet />
			</main>
		</div>

		<app-help-modal [open]="showHelp()" (closed)="showHelp.set(false)" />
		<lib-info-modal />
	`,
	styles: `
		.gm-drawer-bar_title {
			margin-left: 1rem;
		}
	`,
})
export class LayoutComponent implements OnInit, OnDestroy {
	protected auth = inject(AuthService)
	private router = inject(Router)

	isSuperAdmin = computed(() => this.auth.currentUser()?.role === 'superadmin')
	drawerOpen = signal(true)
	showHelp = signal(false)

	currentTheme = signal(document.documentElement.getAttribute('data-theme') ?? 'cupcake')

	private observer = new MutationObserver(() => {
		const t = document.documentElement.getAttribute('data-theme')
		if (t) this.currentTheme.set(t)
	})

	logoUrl = computed(() => {
		const isDark = this.currentTheme() === 'business'
		const filename = isDark ? '/brand-logo-colored-dark.svg' : '/brand-logo-colored.svg'
		return new URL(filename, import.meta.url).href
	})

	readonly themes = { dark: 'business', light: 'cupcake' }

	readonly logoutFn = () => {
		this.auth.clearTokens()
		this.router.navigate(['/login'])
	}

	ngOnInit() {
		this.observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-theme'],
		})
	}

	ngOnDestroy() {
		this.observer.disconnect()
	}
}
