import { Injectable } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Subject, tap} from 'rxjs';
import {environment} from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class BoardService {
  /** Emits after a board is created, renamed or deleted so the sidebar can refresh. */
  private boardsChanged = new Subject<void>();
  public boardsChanged$ = this.boardsChanged.asObservable();

  constructor(private http: HttpClient) {
  }

  getBoards() {
    return this.http.get<Board[]>(`${environment.apiUrl}/board/list`);
  }

  getBoard(id: number) {
    return this.http.get<Board>(`${environment.apiUrl}/board/${id}`, { params: { includeSessions: false } });
  }

  createBoard(board: BoardPayload) {
    return this.http.post<number>(`${environment.apiUrl}/board/create`, board).pipe(
      tap(() => this.boardsChanged.next())
    );
  }

  updateBoard(boardId: number, board: BoardPayload) {
    return this.http.put<void>(`${environment.apiUrl}/board/${boardId}`, board).pipe(
      tap(() => this.boardsChanged.next())
    );
  }

  deleteBoard(boardId: number) {
    return this.http.delete(`${environment.apiUrl}/board/${boardId}`).pipe(
      tap(() => this.boardsChanged.next())
    );
  }

  createColumn(column: { name: string; sortOrder: number }, boardId: number) {
    return this.http.post<number>(`${environment.apiUrl}/board/${boardId}/columns`, column);
  }

  updateColumn(boardId: number, columnId: number, column: { name: string; sortOrder: number }) {
    return this.http.put<void>(`${environment.apiUrl}/board/${boardId}/columns/${columnId}`, column);
  }

  deleteColumn(columnId: number, boardId: number) {
    return this.http.delete(`${environment.apiUrl}/board/${boardId}/columns/${columnId}`);
  }

  getColumnsWithTasks(boardId: number) {
    return this.http.get<Column[]>(`${environment.apiUrl}/board/${boardId}/columns`);
  }
}
