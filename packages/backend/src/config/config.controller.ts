import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from './config.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('config')
@ApiBearerAuth()
@Controller('api/config')
@UseGuards(JwtAuthGuard)
export class ConfigController {
  constructor(private configService: ConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Получить полную конфигурацию' })
  getConfig(@CurrentUser('id') userId: string) {
    return this.configService.getConfig(userId);
  }

  @Put()
  @ApiOperation({ summary: 'Обновить конфигурацию полностью' })
  updateConfig(@CurrentUser('id') userId: string, @Body() body: any) {
    return this.configService.updateConfig(userId, body);
  }

  @Get('search')
  @ApiOperation({ summary: 'Получить секцию поиска' })
  getSearch(@CurrentUser('id') userId: string) {
    return this.configService.getSearchConfig(userId);
  }

  @Put('search')
  @ApiOperation({ summary: 'Обновить секцию поиска' })
  updateSearch(@CurrentUser('id') userId: string, @Body() body: any) {
    return this.configService.updateSearchConfig(userId, body);
  }

  @Get('filter')
  @ApiOperation({ summary: 'Получить секцию фильтров' })
  getFilter(@CurrentUser('id') userId: string) {
    return this.configService.getFilterConfig(userId);
  }

  @Put('filter')
  @ApiOperation({ summary: 'Обновить секцию фильтров' })
  updateFilter(@CurrentUser('id') userId: string, @Body() body: any) {
    return this.configService.updateFilterConfig(userId, body);
  }

  @Get('apply')
  @ApiOperation({ summary: 'Получить секцию откликов' })
  getApply(@CurrentUser('id') userId: string) {
    return this.configService.getApplyConfig(userId);
  }

  @Put('apply')
  @ApiOperation({ summary: 'Обновить секцию откликов' })
  updateApply(@CurrentUser('id') userId: string, @Body() body: any) {
    return this.configService.updateApplyConfig(userId, body);
  }
}
