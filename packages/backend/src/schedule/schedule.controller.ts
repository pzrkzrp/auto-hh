import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ScheduleService } from './schedule.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('schedule')
@ApiBearerAuth()
@Controller('api/schedule')
@UseGuards(JwtAuthGuard)
export class ScheduleController {
  constructor(private scheduleService: ScheduleService) {}

  @Get()
  @ApiOperation({ summary: 'Получить расписание поиска' })
  getSchedule(@CurrentUser('id') userId: string) {
    return this.scheduleService.getSchedule(userId);
  }

  @Put()
  @ApiOperation({ summary: 'Обновить расписание (cron и enabled)' })
  updateSchedule(@CurrentUser('id') userId: string, @Body() body: any) {
    return this.scheduleService.updateSchedule(userId, body);
  }
}
