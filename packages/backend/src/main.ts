import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      const allowed = process.env.CORS_ORIGIN?.split(',') || [
        'http://localhost:4200',
        'http://127.0.0.1:4200',
      ];
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin) return callback(null, true);
      if (allowed.some(o => origin.startsWith(o))) {
        callback(null, true);
      } else {
        callback(null, true); // Allow all for now (dev mode)
      }
    },
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('auto-hh API')
    .setDescription('REST API для поиска, AI-оценки и отклика на вакансии hh.ru')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Аутентификация')
    .addTag('users', 'Профиль пользователя')
    .addTag('config', 'Конфигурация поиска/фильтров/откликов')
    .addTag('resumes', 'Управление резюме')
    .addTag('search', 'Поиск вакансий и джобы')
    .addTag('digest', 'Дайджесты и отклонённые')
    .addTag('apply-queue', 'Очередь откликов')
    .addTag('history', 'История просмотров и откликов')
    .addTag('grade', 'AI-оценка резюме')
    .addTag('schedule', 'Расписание поиска')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Backend: http://localhost:${port}`);
  console.log(`Swagger: http://localhost:${port}/api/docs`);
}

bootstrap();
