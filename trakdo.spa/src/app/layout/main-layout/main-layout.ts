import { Component, OnInit, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import {FormsModule} from '@angular/forms';
import {AuthService} from '../../core/services/auth.service';
import {Notifications} from '../../features/notifications/notifications';
import {BoardService} from '../../core/services/board.service';
import {filter} from 'rxjs';
import {BoardSelectionService} from '../../core/services/board-selection.service';
import {SettingsService} from '../../core/services/settings.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, FormsModule, Notifications],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css'
})
export class MainLayout implements OnInit {
  isSidebarCollapsed = false;
  isMobileMenuOpen = false;
  boards = signal<Board[]>([]);
  selectedBoardId = signal<number | null>(null);

  constructor(
    public authService: AuthService,
    private router: Router,
    private boardService: BoardService,
    private boardSelectionService: BoardSelectionService,
    public settingsService: SettingsService
  ) {
    effect(() => {
      if (this.authService.currentUser()) {
        this.loadBoards();
      }
    });

    effect(() => {
      this.selectedBoardId.set(this.boardSelectionService.selectedBoardId());
    });
  }

  ngOnInit(): void {
    this.ensureSettingsLoaded();
    this.syncSelectedBoardFromUrl(this.router.url);
    this.loadBoards();

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(event => {
        const navigationEnd = event as NavigationEnd;
        this.ensureSettingsLoaded();
        this.syncSelectedBoardFromUrl(navigationEnd.urlAfterRedirects);
        this.loadBoards();
      });
  }

  private ensureSettingsLoaded(): void {
    if (!this.authService.currentUser() || this.settingsService.isLoaded()) {
      return;
    }

    this.settingsService.loadSettings().subscribe({
      error: err => console.error('Failed to load settings in layout', err)
    });
  }

  private loadBoards(): void {
    if (!this.authService.currentUser()) {
      return;
    }

    this.boardService.getBoards().subscribe({
      next: boards => {
        this.boards.set(boards);

        if (boards.length === 0) {
          this.selectedBoardId.set(null);
          this.boardSelectionService.setSelectedBoard(null);
          if (this.isTasksRoute() || this.isCalendarRoute() || this.isSessionsRoute() || this.isStatisticsRoute()) {
            this.router.navigate(['/boards']);
          }
          return;
        }

        const boardIdInRoute = this.getBoardIdFromScopedRoute(this.router.url);
        if (boardIdInRoute !== null) {
          const boardFromRoute = boards.find(board => board.id === boardIdInRoute);
          if (!boardFromRoute) {
            this.router.navigate(['/boards']);
            return;
          }

          this.selectedBoardId.set(boardFromRoute.id);
          this.boardSelectionService.setSelectedBoard(boardFromRoute.id);
          return;
        }

        const currentSelectedId = this.boardSelectionService.selectedBoardId();
        const matchingBoard = boards.find(board => board.id === currentSelectedId);
        const selectedBoardId = matchingBoard?.id ?? boards[0].id;
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
    if (this.isTasksRoute()) {
      this.router.navigate(['/board', parsedBoardId, 'tasks']);
    }
    if (this.isCalendarRoute()) {
      this.router.navigate(['/board', parsedBoardId, 'calendar']);
    }
    if (this.isSessionsRoute()) {
      this.router.navigate(['/board', parsedBoardId, 'sessions']);
    }
    if (this.isStatisticsRoute()) {
      this.router.navigate(['/board', parsedBoardId, 'statistics']);
    }
    this.closeMobileMenu();
  }

  getTasksLink(): (string | number)[] {
    const selectedBoardId = this.selectedBoardId() ?? this.boards()[0]?.id;
    return selectedBoardId ? ['/board', selectedBoardId, 'tasks'] : ['/boards'];
  }

  getCalendarLink(): (string | number)[] {
    const selectedBoardId = this.selectedBoardId() ?? this.boards()[0]?.id;
    return selectedBoardId ? ['/board', selectedBoardId, 'calendar'] : ['/boards'];
  }

  getSessionsLink(): (string | number)[] {
    const selectedBoardId = this.selectedBoardId() ?? this.boards()[0]?.id;
    return selectedBoardId ? ['/board', selectedBoardId, 'sessions'] : ['/boards'];
  }

  getStatisticsLink(): (string | number)[] {
    const selectedBoardId = this.selectedBoardId() ?? this.boards()[0]?.id;
    return selectedBoardId ? ['/board', selectedBoardId, 'statistics'] : ['/boards'];
  }

  isBoardsRoute(): boolean {
    return this.router.url === '/boards' || this.router.url.startsWith('/boards?');
  }

  isTasksRoute(): boolean {
    return this.getScopedRouteType(this.router.url) === 'tasks';
  }

  isCalendarRoute(): boolean {
    return this.getScopedRouteType(this.router.url) === 'calendar';
  }

  isSessionsRoute(): boolean {
    return this.getScopedRouteType(this.router.url) === 'sessions';
  }

  isStatisticsRoute(): boolean {
    return this.getScopedRouteType(this.router.url) === 'statistics';
  }

  private getBoardIdFromScopedRoute(url: string): number | null {
    const match = url.match(/^\/board\/(\d+)\/(tasks|calendar|sessions|statistics)\/?(?:[?#].*)?$/);
    if (!match) {
      return null;
    }

    const boardId = Number(match[1]);
    return Number.isNaN(boardId) ? null : boardId;
  }

  private getScopedRouteType(url: string): 'tasks' | 'calendar' | 'sessions' | 'statistics' | null {
    const match = url.match(/^\/board\/\d+\/(tasks|calendar|sessions|statistics)\/?(?:[?#].*)?$/);
    if (!match) {
      return null;
    }

    return match[1] as 'tasks' | 'calendar' | 'sessions' | 'statistics';
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
  }

  logout(): void {
    this.authService.logout();
  }

  goToSettings(): void {
    this.router.navigate(['/settings']);
    this.closeMobileMenu();
  }
}
