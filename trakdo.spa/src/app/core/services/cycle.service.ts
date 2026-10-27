import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Cycle } from '../models/cycle.model';

@Injectable({
  providedIn: 'root',
})
export class CycleService {
  constructor(private http: HttpClient) {
  }

  /** All cycles of a board, newest first. */
  getCycles(boardId: number) {
    return this.http.get<Cycle[]>(`${environment.apiUrl}/cycle/board/${boardId}`);
  }

  updateSettings(boardId: number, settings: { enabled: boolean; lengthDays: number }) {
    return this.http.put<void>(`${environment.apiUrl}/cycle/board/${boardId}/settings`, settings);
  }

  updateGoal(cycleId: number, goal: string) {
    return this.http.put<void>(`${environment.apiUrl}/cycle/${cycleId}`, { goal });
  }

  /** Archives the cycle's done tasks and starts the next cycle. */
  closeCycle(cycleId: number) {
    return this.http.post<void>(`${environment.apiUrl}/cycle/${cycleId}/close`, null);
  }
}
