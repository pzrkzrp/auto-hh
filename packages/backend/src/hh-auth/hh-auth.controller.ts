import { Controller, Get, Post, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { HhAuthService } from './hh-auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('hh-auth')
@ApiBearerAuth()
@Controller('api/hh-auth')
@UseGuards(JwtAuthGuard)
export class HhAuthController {
  constructor(private hhAuthService: HhAuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Войти на hh.ru (откроется окно браузера для ручного входа)' })
  login(@CurrentUser('id') userId: string) {
    return this.hhAuthService.login(userId);
  }

  @Get('status')
  @ApiOperation({ summary: 'Статус подключения к hh.ru' })
  status(@CurrentUser('id') userId: string) {
    return this.hhAuthService.status(userId);
  }

  @Post('check')
  @ApiOperation({ summary: 'Проверить, что сохранённая сессия hh.ru ещё действует' })
  check(@CurrentUser('id') userId: string) {
    return this.hhAuthService.check(userId);
  }

  @Delete()
  @ApiOperation({ summary: 'Отключить hh.ru (удалить сохранённую сессию)' })
  remove(@CurrentUser('id') userId: string) {
    return this.hhAuthService.remove(userId);
  }
}
