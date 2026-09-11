import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, HostListener, input, output, viewChild } from '@angular/core';
import { Icon } from '../icon/icon';

/**
 * Dialog shell: backdrop, header with close button, Escape to close and initial focus.
 * Put `.modal-body` / `.modal-footer` (optionally wrapped in a <form>) inside it.
 */
@Component({
  selector: 'app-modal',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="modal-backdrop" (mousedown)="onBackdropMouseDown($event)">
      <div #panel class="modal" [class.modal-lg]="size() === 'lg'" role="dialog" aria-modal="true" [attr.aria-label]="title()" tabindex="-1">
        <header class="modal-header">
          <div class="modal-heading">
            <ng-content select="[modalEyebrow]"/>
            <h2 class="modal-title">{{ title() }}</h2>
          </div>
          <button type="button" class="btn btn-ghost btn-icon btn-sm" (click)="closed.emit()" aria-label="Close dialog">
            <app-icon name="x"/>
          </button>
        </header>
        <ng-content/>
      </div>
    </div>
  `,
  styles: [`
    .modal-heading { display: flex; flex-direction: column; gap: 0.35rem; min-width: 0; }
  `]
})
export class Modal implements AfterViewInit {
  title = input.required<string>();
  size = input<'md' | 'lg'>('md');
  closed = output<void>();

  private panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  ngAfterViewInit(): void {
    const panel = this.panel().nativeElement;
    const target = panel.querySelector<HTMLElement>('[autofocus]')
      ?? panel.querySelector<HTMLElement>('.modal-body input:not([type=hidden]), .modal-body textarea')
      ?? panel;
    target.focus();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }

  onBackdropMouseDown(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }
}
