import { Injectable } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {environment} from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class SessionsService {
  constructor(private http: HttpClient) {
  }

  startSession(taskId: number) {
    return this.http.post<Session>(`${environment.apiUrl}/sessions/tasks/${taskId}/sessions/start`, null);
  }

  stopSession(sessionId: number){
    return this.http.patch<Session>(`${environment.apiUrl}/sessions/${sessionId}/stop`, null);
  }

  updateSession(sessionId: number, session: { startTime: string; endTime?: string; notes: string }) {
    return this.http.put<void>(`${environment.apiUrl}/sessions/${sessionId}`, session);
  }

  deleteSession(sessionId: number) {
    return this.http.delete<void>(`${environment.apiUrl}/sessions/${sessionId}`);
  }

  getSessions(start?: string, end?: string, boardId?: number) {
    const params: any = {};
    if (start) params.start = start;
    if (end) params.end = end;
    if (boardId !== undefined && boardId !== null) params.boardId = boardId;
    return this.http.get<any[]>(`${environment.apiUrl}/sessions`, { params });
  }
}
