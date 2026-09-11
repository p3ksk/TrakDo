import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BoardService } from '../../../core/services/board.service';
import { BoardSelectionService } from '../../../core/services/board-selection.service';
import { DateTimeFormatService } from '../../../core/services/date-time-format.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { PageHeader } from '../../../shared/page-header/page-header';
import { COLOR_OPTIONS } from '../../../core/models/color.model';
import { pluralize } from '../../../core/utils/duration';

interface BoardFormState {
  board: Board | null; // null = create
  name: string;
  description: string;
  color: string;
}

@Component({
  selector: 'app-board-list',
  standalone: true,
  imports: [RouterLink, FormsModule, Icon, Modal, PageHeader],
  templateUrl: './board-list.html',
  styleUrl: './board-list.css'
})
export class BoardList implements OnInit {
  private boardService = inject(BoardService);
  private boardSelectionService = inject(BoardSelectionService);
  private dateTimeFormat = inject(DateTimeFormatService);
  private notification = inject(NotificationService);
  private router = inject(Router);

  readonly colorOptions = COLOR_OPTIONS;
  readonly searchThreshold = 6;

  boards = signal<Board[]>([]);
  isLoading = signal(true);
  isSaving = signal(false);
  searchQuery = signal('');
  boardForm = signal<BoardFormState | null>(null);

  filteredBoards = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) {
      return this.boards();
    }

    return this.boards().filter(board =>
      board.name.toLowerCase().includes(query) ||
      (board.description ?? '').toLowerCase().includes(query)
    );
  });

  subtitle = computed(() => this.isLoading() ? '' : pluralize(this.boards().length, 'board'));

  ngOnInit(): void {
    this.loadBoards();
  }

  loadBoards(): void {
    this.boardService.getBoards().subscribe({
      next: boards => {
        this.boards.set([...boards].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id));
        this.isLoading.set(false);
      },
      error: err => {
        console.error(err);
        this.isLoading.set(false);
        this.notification.error('Failed to load boards.');
      }
    });
  }

  openCreate(): void {
    this.boardForm.set({ board: null, name: '', description: '', color: this.colorOptions[0].value });
  }

  openEdit(board: Board): void {
    this.boardForm.set({
      board,
      name: board.name,
      description: board.description ?? '',
      color: board.color || this.colorOptions[0].value
    });
  }

  closeForm(): void {
    this.boardForm.set(null);
  }

  saveBoard(): void {
    const form = this.boardForm();
    const name = form?.name.trim();
    if (!form || !name || this.isSaving()) {
      return;
    }

    const payload: BoardPayload = {
      name,
      description: form.description.trim(),
      color: form.color,
      sortOrder: form.board?.sortOrder ?? this.boards().length
    };

    this.isSaving.set(true);
    if (form.board) {
      this.boardService.updateBoard(form.board.id, payload).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.closeForm();
          this.loadBoards();
        },
        error: () => {
          this.isSaving.set(false);
          this.notification.error('Failed to save board.');
        }
      });
      return;
    }

    this.boardService.createBoard(payload).subscribe({
      next: createdBoardId => {
        this.isSaving.set(false);
        this.closeForm();
        this.boardSelectionService.setSelectedBoard(createdBoardId);
        this.router.navigate(['/board', createdBoardId, 'tasks']);
      },
      error: () => {
        this.isSaving.set(false);
        this.notification.error('Failed to create board.');
      }
    });
  }

  deleteBoard(board: Board): void {
    if (!confirm(`Delete "${board.name}"? All of its columns, tasks and tracked time will be permanently removed.`)) {
      return;
    }

    this.boardService.deleteBoard(board.id).subscribe({
      next: () => {
        this.notification.success(`Deleted "${board.name}".`);
        this.loadBoards();
      },
      error: () => this.notification.error('Failed to delete board.')
    });
  }

  formatCreated(board: Board): string {
    return this.dateTimeFormat.formatDate(this.dateTimeFormat.parseApiDateTime(board.created));
  }
}
