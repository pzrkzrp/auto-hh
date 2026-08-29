import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConfigService } from '../../core/services/config.service';

// Страница /config/new — создание конфига по дизайну Figma: карточка-диалог
// с названием и кнопками «Отмена»/«Добавить». После создания — редирект на
// /config/:id. Enter в поле добавляет конфиг (как в диалоге).
@Component({
  selector: 'app-config-new',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './config-new.html',
  styleUrls: ['./config-new.scss'],
})
export class ConfigNewPageComponent {
  name = signal('');
  creating = signal(false);
  error = signal('');

  private configService = inject(ConfigService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);

  onInput(event: Event) {
    this.name.set((event.target as HTMLInputElement).value);
  }

  // Enter в поле названия = «Добавить».
  onEnter() {
    if (this.name().trim()) this.create();
  }

  create() {
    const name = this.name().trim();
    if (!name || this.creating()) return;
    this.creating.set(true);
    this.error.set('');
    this.configService.createConfig(name).subscribe({
      next: (created) => {
        this.snackBar.open('Конфиг создан', 'OK', { duration: 2000 });
        this.router.navigate(['/config', created._id]);
      },
      error: () => {
        this.error.set('Ошибка создания конфига');
        this.creating.set(false);
      },
    });
  }
}
