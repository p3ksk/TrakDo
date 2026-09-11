import { Component, DestroyRef, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {FormsModule} from '@angular/forms';
import {filter} from 'rxjs';
import {AuthService} from '../../core/services/auth.service';
import {Notifications} from '../../features/notifications/notifications';
import {BoardService} from '../../core/services/board.service';
import {BoardSelectionService} from '../../core/services/board-selection.service';
import {SettingsService} from '../../core/services/settings.service';
import {RunningSession, RunningTimerService} from '../../core/services/running-timer.service';
import {Icon, IconName} from '../../shared/icon/icon';
import {formatClock} from '../../core/utils/duration';

type BoardSection = 'tasks' | 'calendar' | 'sessions' | 'statistics';

interface BoardNavItem {
  section: BoardSection;
  label: string;
  icon: IconName;
}

const SIDEBAR_COLLAPSED_KEY = 'sidebar_collapsed';
const SCOPED_ROUTE = /^\/board\/(\d+)\/(tasks|calendar|sessions|statistics)\/?(?:[?#].*)?$/;

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, FormsModule, Notifications, Icon],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css'
})
export class MainLayout implements OnInit, OnDestroy {
  authService = inject(AuthService);
  settingsService = inject(SettingsService);
  timers = inject(RunningTimerService);
  private router = inject(Router);
  private boardService = inject(BoardService);
  private boardSelectionService = inject(BoardSelectionService);
  private destroyRef = inject(DestroyRef);

  readonly boardNavItems: BoardNavItem[] = [
    { section: 'tasks', label: 'Tasks', icon: 'kanban' },
    { section: 'calendar', label: 'Calendar', icon: 'calendar' },
    { section: 'sessions', label: 'Sessions', icon: 'clock' },
    { section: 'statistics', label: 'Statistics', icon: 'chart' }
  ];

  isSidebarCollapsed = signal(this.readCollapsedPreference());
  isMobileMenuOpen = signal(false);
  settingsLoadFailed = signal(false);
  boards = signal<Board[]>([]);
  selectedBoardId = signal<number | null>(null);
  private currentUrl = signal(this.router.url);

  selectedBoard = computed(() => this.boards().find(board => board.id === this.selectedBoardId()) ?? null);
  activeSection = computed(() => this.getScopedRouteType(this.currentUrl()));
  isBoardsRoute = computed(() => /^\/boards\/?(?:[?#].*)?$/.test(this.currentUrl()));
  isSettingsRoute = computed(() => this.currentUrl().startsWith('/settings'));

  constructor() {
    effect(() => {
      this.selectedBoardId.set(this.boardSelectionService.selectedBoardId());
    });

    effect(() => {
      if (this.settingsService.isLoaded()) {
        this.timers.refresh();
      }
    });
  }

  ngOnInit(): void {
    this.ensureSettingsLoaded();
    this.syncSelectedBoardFromUrl(this.router.url);
    this.loadBoards();

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        const url = (event as NavigationEnd).urlAfterRedirects;
        this.currentUrl.set(url);
        this.isMobileMenuOpen.set(false);
        this.ensureSettingsLoaded();
        this.syncSelectedBoardFromUrl(url);
        this.loadBoards();
      });

    this.boardService.boardsChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadBoards());
  }

  ngOnDestroy(): void {
    this.timers.clear();
  }

  retrySettings(): void {
    this.settingsLoadFailed.set(false);
    this.ensureSettingsLoaded();
  }

  private ensureSettingsLoaded(): void {
    if (!this.authService.currentUser() || this.settingsService.isLoaded()) {
      return;
    }

    this.settingsService.loadSettings().subscribe({
      next: () => this.settingsLoadFailed.set(false),
      error: err => {
        console.error('Failed to load settings in layout', err);
        this.settingsLoadFailed.set(true);
      }
    });
  }

  private loadBoards(): void {
    if (!this.authService.currentUser()) {
      return;
    }

    this.boardService.getBoards().subscribe({
      next: boards => {
        const sortedBoards = [...boards].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
        this.boards.set(sortedBoards);

        if (sortedBoards.length === 0) {
          this.selectedBoardId.set(null);
          this.boardSelectionService.setSelectedBoard(null);
          if (this.activeSection() !== null) {
            this.router.navigate(['/boards']);
          }
          return;
        }

        const boardIdInRoute = this.getBoardIdFromScopedRoute(this.router.url);
        if (boardIdInRoute !== null) {
          const boardFromRoute = sortedBoards.find(board => board.id === boardIdInRoute);
          if (!boardFromRoute) {
            this.router.navigate(['/boards']);
            return;
          }

          this.selectedBoardId.set(boardFromRoute.id);
          this.boardSelectionService.setSelectedBoard(boardFromRoute.id);
          return;
        }

        const currentSelectedId = this.boardSelectionService.selectedBoardId();
        const matchingBoard = sortedBoards.find(board => board.id === currentSelectedId);
        const selectedBoardId = matchingBoard?.id ?? sortedBoards[0].id;
        this.selectedBoardId.set(selectedBoardId);
        this.boardSelectionService.setSelectedBoard(selectedBoardId);
      },
      error: err => console.error('Failed to load boards in sidebar', err)
    });
  }

  private syncSelectedBoardFromUrl(url: string): void {
    const boardId = this.getBoardIdFromScopedRoute(url);
    if (boardId === null) {
      return;
    }

    this.selectedBoardId.set(boardId);
    this.boardSelectionService.setSelectedBoard(boardId);
  }

  onBoardSelectionChange(selectedBoardId: number | string): void {
    const parsedBoardId = Number(selectedBoardId);
    if (Number.isNaN(parsedBoardId)) {
      return;
    }

    this.selectedBoardId.set(parsedBoardId);
    this.boardSelectionService.setSelectedBoard(parsedBoardId);
    // Stay on the same section when switching boards; from other pages jump to the board's tasks.
    this.router.navigate(['/board', parsedBoardId, this.activeSection() ?? 'tasks']);
  }

  linkFor(section: BoardSection): (string | number)[] {
    const selectedBoardId = this.selectedBoardId() ?? this.boards()[0]?.id;
    return selectedBoardId ? ['/board', selectedBoardId, section] : ['/boards'];
  }

  runningClock(session: RunningSession): string {
    return formatClock(this.timers.elapsedSeconds(session));
  }

  private getBoardIdFromScopedRoute(url: string): number | null {
    const match = url.match(SCOPED_ROUTE);
    if (!match) {
      return null;
    }

    const boardId = Number(match[1]);
    return Number.isNaN(boardId) ? null : boardId;
  }

  private getScopedRouteType(url: string): BoardSection | null {
    const match = url.match(SCOPED_ROUTE);
    return match ? match[2] as BoardSection : null;
  }

  toggleSidebar(): void {
    const collapsed = !this.isSidebarCollapsed();
    this.isSidebarCollapsed.set(collapsed);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update(open => !open);
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }

  logout(): void {
    this.timers.clear();
    this.authService.logout();
  }

  private readCollapsedPreference(): boolean {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  }
}
