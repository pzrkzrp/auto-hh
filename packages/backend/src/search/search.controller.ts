import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('search')
@ApiBearerAuth()
@Controller('api/search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Post('jobs')
  @ApiOperation({ summary: 'Создать search-джобу (исполняется CLI)' })
  createJob(@CurrentUser('id') userId: string) {
    return this.searchService.createJob(userId);
  }

  @Get('jobs')
  @ApiOperation({ summary: 'Список последних джоб' })
  listJobs(@CurrentUser('id') userId: string) {
    return this.searchService.listJobs(userId);
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Статус джобы' })
  getJob(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.searchService.getJob(userId, id);
  }

  @Get('results')
  @ApiOperation({ summary: 'Результаты поиска (из кэша/дайджеста)' })
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getResults(
    @CurrentUser('id') userId: string,
    @Query('date') date?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.searchService.getResults(
      userId, date,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }
}
