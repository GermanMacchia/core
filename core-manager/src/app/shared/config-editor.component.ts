import { Component, EventEmitter, Input, Output } from '@angular/core'
import type { ConfigDefinition } from '../core/models/tenant.model'

@Component({
	selector: 'app-config-editor',
	standalone: true,
	template: `
		@if (defs.length > 0) {
			<div class="border-t border-base-200 mt-4 pt-4">
				<span class="text-[10px] font-semibold tracking-widest uppercase text-base-content/30">Config</span>
				<div class="mt-3 flex flex-col gap-3">
					@for (def of defs; track def.key) {
						<div class="flex items-center gap-3">
							<code class="text-xs text-base-content/40 w-36 shrink-0 truncate" [title]="def.description ?? def.key">
								{{ def.key }}
							</code>
							@if (def.type === 'bool') {
								<select
									class="select select-xs select-bordered flex-1 max-w-28"
									[value]="value[def.key] ?? (def.default_val ?? 'false')"
									(change)="onChange(def.key, $any($event.target).value)">
									<option value="true">true</option>
									<option value="false">false</option>
								</select>
							} @else {
								<input
									type="text"
									class="input input-xs input-bordered flex-1"
									[value]="value[def.key] ?? (def.default_val ?? '')"
									(input)="onChange(def.key, $any($event.target).value)"
									[placeholder]="def.type === 'string[]' ? 'val1, val2' : ''" />
							}
						</div>
					}
				</div>
			</div>
		}
	`,
})
export class ConfigEditorComponent {
	@Input() defs: ConfigDefinition[] = []
	@Input() value: Record<string, string> = {}
	@Output() valueChange = new EventEmitter<Record<string, string>>()

	onChange(key: string, val: string) {
		this.valueChange.emit({ ...this.value, [key]: val })
	}
}
