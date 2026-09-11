import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CalendarRangeStateService } from '../../core/services/calendar-range-state.service';
import { Icon } from '../icon/icon';

/** Week/Month toggle + period navigation shared by Calendar, Sessions and Statistics. */
@Component({
  selector: 'app-range-toolbar',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="segmented" role="group" aria-label="Period length">
      <button type="button" [class.is-active]="range.viewMode() === 'week'" [attr.aria-pressed]="range.viewMode() === 'week'" (click)="range.switchView('week')">Week</button>
      <button type="button" [class.is-active]="range.viewMode() === 'month'" [attr.aria-pressed]="range.viewMode() === 'month'" (click)="range.switchView('month')">Month</button>
    </div>

    <div class="period-nav">
      <button type="button" class="btn btn-secondary btn-icon btn-sm" (click)="range.previousPeriod()" [attr.aria-label]="'Previous ' + range.viewMode()">
        <app-icon name="chevron-left" [size]="16"/>
      </button>
      <span class="period-label" aria-live="polite">{{ range.getCurrentPeriodLabel() }}</span>
      <button type="button" class="btn btn-secondary btn-icon btn-sm" (click)="range.nextPeriod()" [attr.aria-label]="'Next ' + range.viewMode()">
        <app-icon name="chevron-right" [size]="16"/>
      </button>
    </div>

    <button type="button" class="btn btn-secondary btn-sm" (click)="range.goToToday()" [disabled]="range.isCurrentPeriod()">
      Today
    </button>
  `,
  styles: [`
    :host {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .period-nav {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }

    .period-label {
      min-width: 150px;
      padding: 0 0.35rem;
      font-size: 0.9375rem;
      font-weight: 600;
      text-align: center;
      white-space: nowrap;
    }

    @media (max-width: 560px) {
      :host { width: 100%; }
      .period-nav { flex: 1; justify-content: space-between; order: 3; width: 100%; }
      .period-label { min-width: 0; }
      .segmented { flex: 1; }
      .segmented button { flex: 1; }
    }
  `]
})
export class RangeToolbar {
  protected range = inject(CalendarRangeStateService);
}
