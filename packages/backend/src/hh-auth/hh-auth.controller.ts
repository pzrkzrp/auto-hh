import { Body, Controller, Get, Post, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { HhAuthService } from './hh-auth.service';
import { HhLoginDto, HhSmsCodeDto, HhSessionIdDto } from './dto/hh-auth.dto';
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
  @ApiOperation({ summary: 'Подтвердить вход на hh.ru кодом (после login с wait_code = true)' })
  sendCode(@CurrentUser('id') userId: string, @Body() dto: HhSmsCodeDto) {
    return this.hhAuthService.sendCode(userId, dto.accountId, dto.code);
  }
  @Get('status')
  @ApiOperation({ summary: 'Список подключённых hh-сессий' })
  status(@CurrentUser('id') userId: string) {
    return this.hhAuthService.status(userId);
  }

  @Post('check')
  @ApiOperation({ summary: 'Проверить, что сохранённая hh-сессия ещё действует' })
  check(@CurrentUser('id') userId: string, @Body() dto: HhSessionIdDto) {
    return this.hhAuthService.check(userId, dto.sessionId);
  }

  @Delete()
  @ApiOperation({ summary: 'Удалить сохранённую hh-сессию' })
  remove(@CurrentUser('id') userId: string, @Body() dto: HhSessionIdDto) {
    return this.hhAuthService.remove(userId, dto.sessionId);
  }
}
