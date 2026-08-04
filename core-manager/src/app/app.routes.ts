import { Routes } from '@angular/router'
import { authGuard } from './core/guards/auth.guard'
import { superAdminGuard } from './core/guards/role.guard'

export const routes: Routes = [
	{
		path: 'login',
		loadComponent: () =>
			import('./pages/login-page/login-page.component').then(m => m.LoginPageComponent),
	},
	{
		path: 'auth/callback',
		loadComponent: () =>
			import('./pages/auth-callback/auth-callback.component').then(m => m.AuthCallbackComponent),
	},
	{
		path: '',
		canActivate: [authGuard],
		loadComponent: () => import('./layout/layout.component').then(m => m.LayoutComponent),
		children: [
			{
				path: '',
				loadComponent: () =>
					import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
			},
			{
				path: 'tenants',
				canActivate: [superAdminGuard],
				loadComponent: () =>
					import('./pages/tenants/tenants.component').then(m => m.TenantsComponent),
			},
			{
				path: 'tenants/:id',
				loadComponent: () =>
					import('./pages/tenant-detail/tenant-detail.component').then(
						m => m.TenantDetailComponent,
					),
			},
			{
				path: 'services',
				canActivate: [superAdminGuard],
				loadComponent: () =>
					import('./pages/services/services.component').then(m => m.ServicesComponent),
			},
			{
				path: 'portals',
				canActivate: [superAdminGuard],
				loadComponent: () =>
					import('./pages/portals/portals.component').then(m => m.PortalsComponent),
			},
			{
				path: 'plans',
				canActivate: [superAdminGuard],
				loadComponent: () =>
					import('./pages/plans/plans.component').then(m => m.PlansComponent),
			},
			{
				path: 'plans/:id',
				canActivate: [superAdminGuard],
				loadComponent: () =>
					import('./pages/plan-detail/plan-detail.component').then(m => m.PlanDetailComponent),
			},
			{
				path: 'config-definitions',
				canActivate: [superAdminGuard],
				loadComponent: () =>
					import('./pages/config-definitions/config-definitions.component').then(
						m => m.ConfigDefinitionsComponent,
					),
			},
		],
	},
	{ path: '**', redirectTo: '' },
]
