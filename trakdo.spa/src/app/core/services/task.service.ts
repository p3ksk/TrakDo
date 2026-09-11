import { Injectable } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {environment} from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class TaskService {
  constructor(private http: HttpClient) {
  }

  createTask(task: Task) {
    return this.http.post<number>(`${environment.apiUrl}/task/create`, task);
  }

  deleteTask(taskId: number) {
    return this.http.delete(`${environment.apiUrl}/task/${taskId}`);
  }

  moveTask(taskId: number, newColumnId: number) {
    return this.http.patch(`${environment.apiUrl}/task/${taskId}/move/${newColumnId}`, null);
  }
}
