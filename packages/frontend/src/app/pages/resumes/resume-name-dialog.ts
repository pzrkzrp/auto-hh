import { Component, Inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { form, required, FormField } from '@angular/forms/signals';

// Диалог ввода имени резюме при загрузке. Имя обязательное — без него файл
// не отправляется (кнопка «Загрузить» неактивна).
@Component({
  selector: 'resume-name-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, FormField],
  templateUrl: './resume-name-dialog.html',
  styleUrls: ['./resume-name-dialog.scss'],
})
export class ResumeNameDialogComponent {
  // Значение формы хранится отдельным сигналом, чтобы подставить подсказку
  // (имя файла без расширения) после создания формы.
  private value = signal({ name: '' });
  nameForm = form(this.value, (f) => required(f.name));

  constructor(
    private dialogRef: MatDialogRef<ResumeNameDialogComponent>,
    @Inject(MAT_DIALOG_DATA) data: { suggestedName: string },
  ) {
    this.value.set({ name: data.suggestedName });
  }

  confirm() {
    const name = this.nameForm().value().name.trim();
    if (!name) return;
    this.dialogRef.close(name);
  }

  close() {
    this.dialogRef.close(null);
  }
}
