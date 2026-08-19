import { Body, Controller, Get, Post, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { HhAuthService } from './hh-auth.service';
import { HhLoginDto, HhSmsCodeDto } from './dto/hh-auth.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('hh-auth')
@ApiBearerAuth()
@Controller('api/hh-auth')
@UseGuards(JwtAuthGuard)
export class HhAuthController {
  constructor(private hhAuthService: HhAuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Войти на hh.ru (откроется окно браузера; телефон/почта и пароль подставляются)' })
  login(@CurrentUser('id') userId: string, @Body() dto: HhLoginDto) {
    return this.hhAuthService.login(userId, dto);
  }
  @Post('send-code')
  @ApiOperation({ summary: 'Подтвердить вход на hh.ru кодом из смс (после login с wait_sms_code = true)' })
  sendCode(@CurrentUser('id') userId: string, @Body() dto: HhSmsCodeDto) {
    return this.hhAuthService.sendCode(userId, dto.code);
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
