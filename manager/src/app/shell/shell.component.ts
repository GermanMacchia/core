import { Component, inject } from '@angular/core'
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router'
import { Router } from '@angular/router'
import { AuthService } from '../core/services/auth.service'

@Component({
	selector: 'app-shell',
	standalone: true,
	imports: [RouterOutlet, RouterLink, RouterLinkActive],
	templateUrl: './shell.component.html',
})
export class ShellComponent {
	protected auth = inject(AuthService)
	private router = inject(Router)

	logout(): void {
		this.auth.clearTokens()
		this.router.navigate(['/login'])
	}
}
