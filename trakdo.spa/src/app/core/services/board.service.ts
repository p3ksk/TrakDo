import { Injectable } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {environment} from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class BoardService {

  constructor(private http: HttpClient) {
  }

  getBoards() {
    return this.http.get<Board[]>(`${environment.apiUrl}/board/list`);
  }

  getBoard(id: number) {
    return this.http.get<Board>(`${environment.apiUrl}/board/${id}`);
  }

  createBoard(board: Board) {
    return this.http.post<number>(`${environment.apiUrl}/board/create`, board);
  }

  deleteBoard(boardId: number) {
    return this.http.delete(`${environment.apiUrl}/board/${boardId}`);
  }

  createColumn(column: Column, boardId: number) {
    return this.http.post<Column>(`${environment.apiUrl}/board/${boardId}/columns`, column);
  }

  deleteColumn(columnId: number, boardId: number) {
    return this.http.delete(`${environment.apiUrl}/board/${boardId}/columns/${columnId}`);
  }

  getColumnsWithTasks(boardId: number) {
    return this.http.get<Column[]>(`${environment.apiUrl}/board/${boardId}/columns`);
  }
}
