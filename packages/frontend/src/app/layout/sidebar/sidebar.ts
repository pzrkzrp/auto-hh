import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatListModule } from '@angular/material/list';

type NavItem = { label: string; icon: string; link: string };
type NavGroup = { title: string; items: NavItem[] };

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [MatListModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.scss'],
})
export class SidebarComponent {
  groups: NavGroup[] = [
    { title: 'Обзор', items: [
      { label: 'Дашборд', icon: '📊', link: '/dashboard' },
      { label: 'Поиск', icon: '🔎', link: '/search' },
      { label: 'Дайджест', icon: '📰', link: '/digest' },
      { label: 'Отклики', icon: '✉️', link: '/apply-queue' },
      { label: 'История', icon: '🕘', link: '/history' },
    ]},
    { title: 'Резюмейкер', items: [
      { label: 'Резюме', icon: '📄', link: '/resumes' },
      { label: 'Оценка', icon: '⭐', link: '/grade' },
    ]},
    { title: 'Система', items: [
      { label: 'Конфиг', icon: '⚙️', link: '/config' },
      { label: 'Настройки', icon: '👤', link: '/settings' },
    ]},
  ];
}
