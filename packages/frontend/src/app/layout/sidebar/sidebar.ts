import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { ThemeService } from '../../core/services/theme.service';

type NavItem = { label: string; icon?: string; link: string };
type NavGroup = { title: string; items: NavItem[] };

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [MatListModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.scss'],
})
export class SidebarComponent {
  readonly theme = inject(ThemeService);

  groups: NavGroup[] = [
    { title: 'Обзор', items: [
      { label: 'Дашборд', icon: '📊', link: '/dashboard' },
      { label: 'Дайджест', icon: '📰', link: '/digest' },
      { label: 'Отклики', icon: '✉️', link: '/apply-queue' },
      { label: 'История', icon: '🕘', link: '/history' },
    ]},
    {
      title: 'Вакансии', items: [
        { label: 'Поиск', link: '/search' },
      ]
    },
    { title: 'Резюмейкер', items: [
      { label: 'Резюме', icon: '📄', link: '/resumes' },
      { label: 'Оценка', icon: '⭐', link: '/grade' },
    ]},
    { title: 'Система', items: [
      { label: 'Настройки', icon: '👤', link: '/settings' },
      { label: 'Конфиг', link: '/config' },

      ]},
  ];
}
