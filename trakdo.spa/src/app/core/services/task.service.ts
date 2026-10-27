import { Injectable } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {environment} from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class TaskService {
  constructor(private http: HttpClient) {
  }

  createTask(task: NewTaskPayload) {
    return this.http.post<number>(`${environment.apiUrl}/task/create`, task);
  }

  updateTask(taskId: number, task: TaskPayload) {
    return this.http.put<void>(`${environment.apiUrl}/task/${taskId}`, task);
  }

  deleteTask(taskId: number) {
    return this.http.delete(`${environment.apiUrl}/task/${taskId}`);
  }

  moveTask(taskId: number, newColumnId: number) {
    return this.http.patch(`${environment.apiUrl}/task/${taskId}/move/${newColumnId}`, null);
  }

  getArchivedTasks(boardId: number) {
    return this.http.get<Task[]>(`${environment.apiUrl}/task/board/${boardId}/archived`);
  }

  archiveTask(taskId: number) {
    return this.http.patch<void>(`${environment.apiUrl}/task/${taskId}/archive`, null);
  }

  restoreTask(taskId: number) {
    return this.http.patch<void>(`${environment.apiUrl}/task/${taskId}/restore`, null);
  }

  /** Archives every task in the board's done column; emits how many were archived. */
  archiveDoneTasks(boardId: number) {
    return this.http.post<number>(`${environment.apiUrl}/task/board/${boardId}/archive-done`, null);
  }
}
