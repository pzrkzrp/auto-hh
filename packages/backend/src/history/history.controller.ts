import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { HistoryService } from './history.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('history')
@ApiBearerAuth()
@Controller('api/history')
@UseGuards(JwtAuthGuard)
export class HistoryController {
  constructor(private historyService: HistoryService) {}

  @Get()
  @ApiOperation({ summary: 'История просмотров и откликов' })
  @ApiQuery({ name: 'status', required: false, description: 'applied или seen' })
  @ApiQuery({ name: 'limit', required: false, description: 'Лимит записей' })
  @ApiQuery({ name: 'offset', required: false, description: 'Смещение' })
  getHistory(
    @CurrentUser('id') userId: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.historyService.getHistory(userId, {
      status,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get('applied')
  @ApiOperation({ summary: 'Только отклики' })
  getApplied(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.historyService.getHistory(userId, {
      status: 'applied',
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Статистика: всего/сегодня просмотрено и откликов' })
  getStats(@CurrentUser('id') userId: string) {
    return this.historyService.getStats(userId);
  }
}
