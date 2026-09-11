import { Routes } from '@angular/router';
import {MainLayout} from './layout/main-layout/main-layout';
import {Calendar} from './features/calendar/calendar';
import {authGuard} from './core/guards/auth-guard';
import {Settings} from './features/settings/settings';
import {BoardDetail} from './features/boards/board-detail/board-detail';
import {Sessions} from './features/sessions/sessions';
import {Statistics} from './features/statistics/statistics';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(x => x.routes)
  },
  {
    path: '',
    canActivate: [authGuard],
    component: MainLayout,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'boards'
      },
      {
        path: 'boards/:boardId',
        redirectTo: 'board/:boardId/tasks'
      },
      {
        path: 'calendar/:boardId',
        redirectTo: 'board/:boardId/calendar'
      },
      {
        path: 'calendar',
        redirectTo: 'boards'
      },
      {
        path: 'sessions',
        redirectTo: 'boards'
      },
      {
        path: 'statistics',
        component: Statistics
      },
      {
        path: 'board/:boardId/tasks',
        component: BoardDetail
      },
      {
        path: 'board/:boardId/calendar',
        component: Calendar
      },
      {
        path: 'board/:boardId/sessions',
        component: Sessions
      },
      {
        path: 'board/:boardId/statistics',
        component: Statistics
      },
      {
        path: 'boards',
        loadChildren: () => import('./features/boards/board.routes').then(m => m.routes)
      },
      {
        path: 'settings',
        component: Settings
      }
    ]
  }
];
