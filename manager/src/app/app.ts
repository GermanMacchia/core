import { Component, OnDestroy, OnInit, signal, ViewEncapsulation } from '@angular/core'
import { RouterOutlet } from '@angular/router'

@Component({
	selector: 'app-root',
	standalone: true,
	imports: [RouterOutlet],
	template: '<div [attr.data-theme]="theme()"><router-outlet /></div>',
	encapsulation: ViewEncapsulation.ShadowDom,
	styleUrls: ['../styles.css'],
})
export class App implements OnInit, OnDestroy {
	// lib-drawer-bar sets data-theme on <html>; mirror it here so DaisyUI selectors
	// inside the shadow root react to theme changes.
	theme = signal(
		localStorage.getItem('data-theme') ?? document.documentElement.getAttribute('data-theme') ?? 'corporate',
	)

	private observer = new MutationObserver(() => {
		const t = document.documentElement.getAttribute('data-theme')
		if (t) this.theme.set(t)
	})

	ngOnInit() {
		this.observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
	}

	ngOnDestroy() {
		this.observer.disconnect()
	}
}
