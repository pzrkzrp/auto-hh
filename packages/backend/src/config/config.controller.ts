import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from './config.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

// Конфиги множественные: GET list / POST create / GET/PUT/DELETE :id /
// PUT :id/{search,filter,apply,resume}. Роут GET list объявлен до GET :id,
// чтобы не перехватываться параметрическим сегментом.
@ApiTags('config')
@ApiBearerAuth()
@Controller('api/config')
@UseGuards(JwtAuthGuard)
export class ConfigController {
  constructor(private configService: ConfigService) {}

  @Get('list')
  @ApiOperation({ summary: 'Список конфигов пользователя' })
  listConfigs(@CurrentUser('id') userId: string) {
    return this.configService.listConfigs(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Создать конфиг (name обязателен)' })
  createConfig(@CurrentUser('id') userId: string, @Body() body: any) {
    if (!body?.name || !body.name.trim()) {
      throw new BadRequestException('Config name is required');
    }
    return this.configService.createConfig(userId, body.name.trim());
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить конфиг по id' })
  getConfig(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.configService.getConfig(userId, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Обновить конфиг полностью (включая name)' })
  updateConfig(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() body: any) {
    return this.configService.updateConfig(userId, id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить конфиг' })
  deleteConfig(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.configService.deleteConfig(userId, id);
  }

  @Put(':id/search')
  @ApiOperation({ summary: 'Обновить секцию поиска конфига' })
  updateSearch(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() body: any) {
    return this.configService.updateSearchConfig(userId, id, body);
  }

  @Put(':id/filter')
  @ApiOperation({ summary: 'Обновить секцию фильтров конфига' })
  updateFilter(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() body: any) {
    return this.configService.updateFilterConfig(userId, id, body);
  }

  @Put(':id/apply')
  @ApiOperation({ summary: 'Обновить секцию откликов конфига' })
  updateApply(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() body: any) {
    return this.configService.updateApplyConfig(userId, id, body);
  }

  @Put(':id/resume')
  @ApiOperation({ summary: 'Обновить резюме конфига (resumeId из коллекции resumes)' })
  updateResume(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() body: any) {
    return this.configService.updateResumeConfig(userId, id, body.resumeId);
  }
}
