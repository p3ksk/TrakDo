import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName =
  | 'kanban' | 'calendar' | 'clock' | 'chart' | 'grid' | 'settings' | 'logout' | 'menu' | 'x'
  | 'plus' | 'trash' | 'pencil' | 'play' | 'stop' | 'chevron-left' | 'chevron-right' | 'chevron-down'
  | 'search' | 'eye' | 'eye-off' | 'check' | 'alert' | 'info' | 'panel-left' | 'note';

/** Inline stroke icons (Lucide-style, 24x24 grid) so they inherit color and render the same on every OS. */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-icon', 'aria-hidden': 'true' },
  styles: [`:host { display: inline-flex; flex-shrink: 0; line-height: 0; } svg { display: block; }`],
  template: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" [attr.width]="size()" [attr.height]="size()"
         fill="none" stroke="currentColor" [attr.stroke-width]="strokeWidth()" stroke-linecap="round" stroke-linejoin="round">
      @switch (name()) {
        @case ('kanban') { <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 7v7M12 7v4M16 7v9"/> }
        @case ('calendar') { <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/> }
        @case ('clock') { <circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M10 2h4"/> }
        @case ('chart') { <path d="M3 3v18h18"/><path d="M8 17v-5M13 17V8M18 17v-8"/> }
        @case ('grid') { <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/> }
        @case ('settings') { <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/> }
        @case ('logout') { <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/> }
        @case ('menu') { <path d="M4 6h16M4 12h16M4 18h16"/> }
        @case ('x') { <path d="M18 6 6 18M6 6l12 12"/> }
        @case ('plus') { <path d="M12 5v14M5 12h14"/> }
        @case ('trash') { <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/> }
        @case ('pencil') { <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/> }
        @case ('play') { <path d="M7 4.5v15a1 1 0 0 0 1.5.87l12-7.5a1 1 0 0 0 0-1.74l-12-7.5A1 1 0 0 0 7 4.5z" fill="currentColor" stroke="none"/> }
        @case ('stop') { <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/> }
        @case ('chevron-left') { <path d="m15 18-6-6 6-6"/> }
        @case ('chevron-right') { <path d="m9 18 6-6-6-6"/> }
        @case ('chevron-down') { <path d="m6 9 6 6 6-6"/> }
        @case ('search') { <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/> }
        @case ('eye') { <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/> }
        @case ('eye-off') { <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19M6.61 6.61A18.5 18.5 0 0 0 2 11s3.5 7 10 7a9.7 9.7 0 0 0 5.39-1.61M14.12 14.12a3 3 0 1 1-4.24-4.24M2 2l20 20"/> }
        @case ('check') { <path d="M20 6 9 17l-5-5"/> }
        @case ('alert') { <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/> }
        @case ('info') { <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/> }
        @case ('panel-left') { <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/> }
        @case ('note') { <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"/><path d="M14 2v6h6M8 13h8M8 17h5"/> }
      }
    </svg>
  `
})
export class Icon {
  name = input.required<IconName>();
  size = input<number>(18);
  strokeWidth = input<number>(2);
}
