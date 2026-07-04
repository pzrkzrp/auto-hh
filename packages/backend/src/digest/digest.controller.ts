import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DigestService } from './digest.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('digest')
@ApiBearerAuth()
@Controller('api/digest')
@UseGuards(JwtAuthGuard)
export class DigestController {
  constructor(private digestService: DigestService) {}

  @Get()
  @ApiOperation({ summary: 'Получить дайджесты' })
  @ApiQuery({ name: 'date', required: false, description: 'Дата в формате YYYY-MM-DD' })
  getDigest(@CurrentUser('id') userId: string, @Query('date') date?: string) {
    return this.digestService.getDigest(userId, date);
  }

  @Get('latest')
  @ApiOperation({ summary: 'Получить последний дайджест' })
  getLatest(@CurrentUser('id') userId: string) {
    return this.digestService.getLatestDigest(userId);
  }

  @Get('dates')
  @ApiOperation({ summary: 'Список дат с дайджестами' })
  getDates(@CurrentUser('id') userId: string) {
    return this.digestService.getDigestDates(userId);
  }

  @Get('rejected')
  @ApiOperation({ summary: 'Получить отклонённые вакансии' })
  @ApiQuery({ name: 'date', required: false, description: 'Дата YYYY-MM-DD' })
  getRejected(@CurrentUser('id') userId: string, @Query('date') date?: string) {
    return this.digestService.getRejected(userId, date);
  }
}
