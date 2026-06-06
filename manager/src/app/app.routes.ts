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
		path: '',
		canActivate: [authGuard],
		loadComponent: () => import('./shell/shell.component').then(m => m.ShellComponent),
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
		],
	},
	{ path: '**', redirectTo: '' },
]
