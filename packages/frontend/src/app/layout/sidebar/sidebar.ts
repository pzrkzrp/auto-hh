import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ThemeService } from '../../core/services/theme.service';

type NavItem = { label: string; icon: string; link: string };

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [MatIconModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.scss'],
})
export class SidebarComponent {
  readonly theme = inject(ThemeService);

  navItems: NavItem[] = [
    { label: 'Дашборд', icon: 'dashboard', link: '/dashboard' },
    { label: 'Дайджест', icon: 'article', link: '/digest' },
    { label: 'Отклики', icon: 'outbox', link: '/apply-queue' },
    { label: 'История', icon: 'history', link: '/history' },
    { label: 'Поиск', icon: 'search', link: '/search' },
    { label: 'Резюме', icon: 'description', link: '/resumes' },
    { label: 'Оценка', icon: 'grade', link: '/grade' },
  ];

  footerItems: NavItem[] = [
    { label: 'Настройки', icon: 'settings', link: '/settings' },
    { label: 'Конфиг', icon: 'tune', link: '/config' },
  ];
}
