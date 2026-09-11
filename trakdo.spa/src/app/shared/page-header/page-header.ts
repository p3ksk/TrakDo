import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Title block used at the top of every main page. Project actions into it. */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'page-header' },
  template: `
    <div class="page-heading">
      @if (color()) {
        <span class="page-color-bar" [style.background]="color()"></span>
      }
      <div>
        @if (eyebrow()) {
          <span class="page-eyebrow">{{ eyebrow() }}</span>
        }
        <h1 class="page-title">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="page-subtitle">{{ subtitle() }}</p>
        }
      </div>
    </div>
    <div class="page-actions">
      <ng-content/>
    </div>
  `
})
export class PageHeader {
  title = input.required<string>();
  eyebrow = input<string>('');
  subtitle = input<string | null | undefined>('');
  color = input<string | null | undefined>(null);
}
