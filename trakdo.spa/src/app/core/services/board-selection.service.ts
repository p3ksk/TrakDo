import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class BoardSelectionService {
  private readonly STORAGE_KEY = 'selected_board_id';
  private selectedBoardIdSignal = signal<number | null>(this.readInitialSelectedBoardId());
  public selectedBoardId = this.selectedBoardIdSignal.asReadonly();

  setSelectedBoard(boardId: number | null): void {
    this.selectedBoardIdSignal.set(boardId);
    if (boardId === null) {
      localStorage.removeItem(this.STORAGE_KEY);
      return;
    }

    localStorage.setItem(this.STORAGE_KEY, boardId.toString());
  }

  private readInitialSelectedBoardId(): number | null {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const parsed = Number(stored);
    return Number.isNaN(parsed) ? null : parsed;
  }
}
