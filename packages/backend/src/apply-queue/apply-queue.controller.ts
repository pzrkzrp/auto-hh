import { Controller, Get, Post, Delete, Patch, Body, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ApplyQueueService } from './apply-queue.service';
import type { QueueStatus } from './apply-queue.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('apply-queue')
@ApiBearerAuth()
@Controller('api/apply-queue')
@UseGuards(JwtAuthGuard)
export class ApplyQueueController {
  constructor(private applyQueueService: ApplyQueueService) {}

  @Get()
  @ApiOperation({ summary: 'Список элементов очереди' })
  @ApiQuery({ name: 'status', required: false, description: 'Фильтр по статусу: queued, processing, success, failed, skipped' })
  getQueue(@CurrentUser('id') userId: string, @Query('status') status?: QueueStatus) {
    return this.applyQueueService.getQueue(userId, status);
  }

  @Post()
  @ApiOperation({ summary: 'Добавить вакансии в очередь на отклик' })
  addToQueue(@CurrentUser('id') userId: string, @Body() body: { items: any[] }) {
    return this.applyQueueService.addToQueue(userId, body.items || []);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить элемент очереди по ID' })
  getItem(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.applyQueueService.getQueueItem(userId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить элемент из очереди' })
  removeItem(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.applyQueueService.removeFromQueue(userId, id);
  }

  @Patch('batch')
  @ApiOperation({ summary: 'Массовое действие: queue, remove, retry' })
  batchAction(
    @CurrentUser('id') userId: string,
    @Body() body: { ids: string[]; action: 'queue' | 'remove' | 'retry' },
  ) {
    return this.applyQueueService.batchAction(userId, body.ids, body.action);
  }
}
