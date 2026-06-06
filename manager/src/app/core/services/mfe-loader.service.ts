import { Injectable } from '@angular/core'

@Injectable({ providedIn: 'root' })
export class MfeLoaderService {
	private loaded = new Set<string>()

	load(url: string): Promise<void> {
		if (this.loaded.has(url)) return Promise.resolve()

		return new Promise((resolve, reject) => {
			const script = document.createElement('script')
			script.src = url
			script.onload = () => {
				this.loaded.add(url)
				resolve()
			}
			script.onerror = () => reject(new Error(`Failed to load MFE: ${url}`))
			document.head.appendChild(script)
		})
	}

	isLoaded(url: string): boolean {
		return this.loaded.has(url)
	}
}
