import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BoardService } from '../../../core/services/board.service';

@Component({
  selector: 'app-board-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './board-list.html',
  styleUrl: './board-list.css'
})
export class BoardList implements OnInit {
  boards = signal<Board[]>([]);
  filteredBoards = signal<Board[]>([]);
  searchQuery = '';
  showCreateModal = false;

  newBoard: Board = {
    createdAt: new Date,
    id: 0,
    sortOrder: 0,
    tasksCount: 0,
    updatedAt: new Date(),
    name: '',
    description: '',
    color: '#09C1BF'
  };

  colorOptions = [
    { value: '#09C1BF', label: 'Teal' },
    { value: '#FD7F44', label: 'Orange' },
    { value: '#FCCE5F', label: 'Yellow' },
    { value: '#10b981', label: 'Green' },
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#ec4899', label: 'Pink' }
  ];

  constructor(private boardService: BoardService) {
  }

  ngOnInit(): void {
    this.loadBoards();
  }

  loadBoards(): void {
    this.boardService.getBoards().subscribe({
      next: (boards) => {
        this.boards.set(boards);
        this.searchBoards()
      },
      error: (err) => console.error(err)
    });
  }

  searchBoards(): void {
    const query = this.searchQuery.toLowerCase().trim();

    if (!query) {
      this.filteredBoards.set([...this.boards()]);
      return;
    }

    this.filteredBoards.set(this.boards().filter(board =>
      board.name.toLowerCase().includes(query) ||
      board.description.toLowerCase().includes(query)
    ));
  }

  openCreateModal(): void {
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.resetForm();
  }

  createBoard(): void {
    if (!this.newBoard.name.trim()) {
      return;
    }

    const board: Board = {
      id: 0,
      name: this.newBoard.name,
      description: this.newBoard.description,
      color: this.newBoard.color,
      tasksCount: 0,
      sortOrder: this.boards().length,
      createdAt: new Date(),
      updatedAt: new Date()
    };


    this.boardService.createBoard(board).subscribe(createdBoardId => {
      board.id = createdBoardId;
      this.boards().unshift(board);
      this.searchBoards();
      this.closeCreateModal();
    });
  }

  deleteBoard(id: number): void {
    if (confirm('Are you sure you want to delete this board?')) {
      this.boardService.deleteBoard(id).subscribe({
        next: () => this.loadBoards()
      })
    }
  }


  resetForm(): void {
    this.newBoard = {
      createdAt: new Date(),
      id: 0,
      sortOrder: 0,
      tasksCount: 0,
      updatedAt: new Date(),
      name: '',
      description: '',
      color: '#09C1BF'
    };
  }

  getRelativeTime(date: Date): string {
    const now = new Date();
    const diffInMs = now.getTime() - new Date(date).getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    return `${Math.floor(diffInDays / 30)} months ago`;
  }
}
